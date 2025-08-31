// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract TangentEscrow is AccessControl {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    IERC20 public immutable TGT;
    address public immutable treasury;

    enum Status { Created, Confirmed, BuyerDeposited, KeyIssued, AwaitingPayment, AwaitingKey, Complete, Defaulted }

    struct Trade {
        address supplier;
        address buyer;
        address downstreamBuyer;
        uint256 p1;
        uint16 depositPct;
        uint16 financePct;
        uint256 depositPaid;
        uint256 finalPaid;
        bytes32 keyHash;
        uint64 finalDeadline;
        Status status;
    }

    uint256 public nextTradeId;
    mapping(uint256 => Trade) public trades;

    event TradeCreated(uint256 indexed id, address supplier, address buyer, uint256 p1);
    event Confirmed(uint256 indexed id);
    event BuyerDeposited(uint256 indexed id, uint256 amount);
    event DocsAcceptedKeyIssued(uint256 indexed id, bytes32 keyHash, uint64 finalDeadline, uint256 supplierPayout);
    event FinalPaid(uint256 indexed id, uint256 amount, address payer);
    event Claimed(uint256 indexed id);
    event Defaulted(uint256 indexed id);

    constructor(IERC20 _tgt, address _treasury) {
        TGT = _tgt;
        treasury = _treasury;
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
    }

    function createTrade(
        address supplier,
        address buyer,
        uint256 p1,
        uint16 depositPct,
        uint16 financePct
    ) external onlyRole(ADMIN_ROLE) returns (uint256 id) {
        require(supplier != address(0) && buyer != address(0), "bad parties");
        require(depositPct + financePct == 100, "bad pct");

        id = ++nextTradeId;
        trades[id] = Trade({
            supplier: supplier,
            buyer: buyer,
            downstreamBuyer: address(0),
            p1: p1,
            depositPct: depositPct,
            financePct: financePct,
            depositPaid: 0,
            finalPaid: 0,
            keyHash: bytes32(0),
            finalDeadline: 0,
            status: Status.Confirmed
        });

        emit TradeCreated(id, supplier, buyer, p1);
        emit Confirmed(id);
    }

    function setDownstream(uint256 id, address dsBuyer) external onlyRole(ADMIN_ROLE) {
        trades[id].downstreamBuyer = dsBuyer;
    }

    function buyerDeposit(uint256 id, uint256 amount) external {
        Trade storage t = trades[id];
        require(t.status == Status.Confirmed, "not confirmed");
        uint256 requiredDep = (t.p1 * t.depositPct) / 100;
        require(amount == requiredDep, "must be exact 30%");
        require(TGT.transferFrom(msg.sender, address(this), amount), "transfer failed");
        t.depositPaid = amount;
        t.status = Status.BuyerDeposited;
        emit BuyerDeposited(id, amount);
    }

    function acceptDocsAndIssueKey(uint256 id, bytes32 keyHash, uint64 finalDeadline) external onlyRole(ADMIN_ROLE) {
        Trade storage t = trades[id];
        require(t.status == Status.BuyerDeposited && t.depositPaid > 0, "no deposit");
        require(TGT.transfer(t.supplier, t.depositPaid), "escrow->supplier 30% failed");
        uint256 finAmt = (t.p1 * t.financePct) / 100;
        (bool ok, ) = address(TGT).call(abi.encodeWithSignature("mint(address,uint256)", t.supplier, finAmt));
        require(ok, "mint 70% failed");

        t.keyHash = keyHash;
        t.finalDeadline = finalDeadline;
        t.status = Status.AwaitingPayment;
        emit DocsAcceptedKeyIssued(id, keyHash, finalDeadline, t.depositPaid + finAmt);
    }

    function payFinal(uint256 id, uint256 amount) external {
        Trade storage t = trades[id];
        require(msg.sender == t.buyer || msg.sender == t.downstreamBuyer, "only buyer/downstream");
        require(t.status == Status.AwaitingPayment || t.status == Status.AwaitingKey, "bad status");
        uint256 due = (t.p1 * t.financePct) / 100;
        require(amount == due, "must be exact 70%");
        require(TGT.transferFrom(msg.sender, treasury, amount), "pay final failed");
        t.finalPaid = amount;
        if (t.status == Status.AwaitingKey) t.status = Status.Complete;
        else t.status = Status.AwaitingKey;
        emit FinalPaid(id, amount, msg.sender);
    }

    function claimDocs(uint256 id, string calldata keyPlain) external {
        Trade storage t = trades[id];
        require(msg.sender == t.buyer || msg.sender == t.downstreamBuyer, "only buyer/downstream");
        require(t.keyHash != bytes32(0), "no key");
        require(keccak256(abi.encodePacked(keyPlain)) == t.keyHash, "bad key");
        if (t.finalPaid > 0) t.status = Status.Complete;
        else t.status = Status.AwaitingPayment;
        emit Claimed(id);
    }

    function markDefault(uint256 id) external onlyRole(ADMIN_ROLE) {
        Trade storage t = trades[id];
        require(block.timestamp > t.finalDeadline && t.status != Status.Complete, "not overdue");
        t.status = Status.Defaulted;
        emit Defaulted(id);
    }
}
