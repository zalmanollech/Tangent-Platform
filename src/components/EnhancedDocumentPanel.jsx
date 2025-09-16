import React, { useState, useEffect, useMemo } from "react";
import { ethers } from "ethers";
import { useWallet } from "../wallet";

// Document Registry Contract (if available)
const DOCREG = (process.env.REACT_APP_DOCREG_ADDRESS || "").trim();
const WEB3_TOKEN = (process.env.REACT_APP_WEB3_STORAGE_TOKEN || "").trim();

const regAbi = [
  "function registerDocument(uint256 orderId, uint8 docType, bytes32 sha256Hash, string uri) returns (uint256)",
  "function acceptDocument(uint256 orderId, uint256 index)",
  "function rejectDocument(uint256 orderId, uint256 index)",
  "function getDocsCount(uint256 orderId) view returns (uint256)",
  "function getDoc(uint256 orderId, uint256 index) view returns (uint8,bytes32,string,address,uint64,bool,address,bool)",
  "function isAccepted(uint256, uint8) view returns (bool)"
];

const DocType = { 
  EBL: 0, 
  CommercialInvoice: 1, 
  PackingList: 2, 
  Certificate: 3, 
  Other: 4 
};

const DocTypeLabels = {
  [DocType.EBL]: "Electronic Bill of Lading (eBL)",
  [DocType.CommercialInvoice]: "Commercial Invoice",
  [DocType.PackingList]: "Packing List",
  [DocType.Certificate]: "Certificate of Origin",
  [DocType.Other]: "Other Document"
};

function bytesToHex(bytes) {
  return '0x' + Array.from(new Uint8Array(bytes)).map(b => b.toString(16).padStart(2,'0')).join('');
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatAddress(address) {
  if (!address) return 'N/A';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatTimestamp(timestamp) {
  if (!timestamp) return 'N/A';
  return new Date(Number(timestamp) * 1000).toLocaleString();
}

export default function EnhancedDocumentPanel() {
  const { account, isSepolia } = useWallet();
  const [orderId, setOrderId] = useState("");
  const [docType, setDocType] = useState(DocType.EBL);
  const [file, setFile] = useState(null);
  const [manualCid, setManualCid] = useState("");
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState([]);
  const [docs, setDocs] = useState([]);
  const [eblAccepted, setEblAccepted] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState(null);

  const provider = useMemo(() => {
    if (typeof window !== 'undefined' && window.ethereum) {
      return new ethers.BrowserProvider(window.ethereum);
    }
    return null;
  }, []);

  const addLog = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = `[${timestamp}] ${message}`;
    setLog(prev => [...prev, { message: logEntry, type, timestamp }]);
  };

  const clearError = () => setError(null);

  async function getReg(runner) {
    if (!DOCREG) throw new Error("Document Registry contract not configured");
    return new ethers.Contract(DOCREG, regAbi, runner);
  }

  async function refresh() {
    if (!orderId || !DOCREG) return;
    try {
      setBusy(true);
      setError(null);
      addLog("Refreshing documents...", 'info');
      
      const reg = await getReg(provider);
      const n = Number(await reg.getDocsCount(orderId));
      const arr = [];
      
      for (let i = 0; i < n; i++) {
        const [t, hash, uri, uploader, uploadedAt, accepted, acceptedBy, rejected] = await reg.getDoc(orderId, i);
        arr.push({ 
          index: i, 
          type: t, 
          hash, 
          uri, 
          uploader, 
          uploadedAt, 
          accepted, 
          acceptedBy, 
          rejected 
        });
      }
      
      setDocs(arr);
      const eblStatus = await reg.isAccepted(orderId, DocType.EBL);
      setEblAccepted(eblStatus);
      
      addLog(`Loaded ${n} documents. eBL accepted: ${eblStatus ? 'YES' : 'NO'}`, 'success');
    } catch (e) {
      const errorMsg = e.message || String(e);
      addLog(`Refresh error: ${errorMsg}`, 'error');
      setError(errorMsg);
    } finally {
      setBusy(false);
    }
  }

  async function uploadToWeb3(file) {
    if (!WEB3_TOKEN) {
      throw new Error("Web3.Storage token not configured. Please set REACT_APP_WEB3_STORAGE_TOKEN");
    }

    const form = new FormData();
    form.append("file", file);
    
    // Add metadata
    form.append("metadata", JSON.stringify({
      name: file.name,
      size: file.size,
      type: file.type,
      uploadedAt: new Date().toISOString()
    }));

    setUploadProgress(0);
    
    const xhr = new XMLHttpRequest();
    
    return new Promise((resolve, reject) => {
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percentComplete = (e.loaded / e.total) * 100;
          setUploadProgress(percentComplete);
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status === 200) {
          try {
            const response = JSON.parse(xhr.responseText);
            resolve(`ipfs://${response.cid}`);
          } catch (e) {
            reject(new Error('Invalid response from Web3.Storage'));
          }
        } else {
          reject(new Error(`Upload failed: ${xhr.status} ${xhr.statusText}`));
        }
      });

      xhr.addEventListener('error', () => {
        reject(new Error('Upload failed due to network error'));
      });

      xhr.open('POST', 'https://api.web3.storage/upload');
      xhr.setRequestHeader('Authorization', `Bearer ${WEB3_TOKEN}`);
      xhr.send(form);
    });
  }

  async function hashFile(theFile) {
    const buf = await theFile.arrayBuffer();
    const digest = await crypto.subtle.digest("SHA-256", buf);
    return bytesToHex(digest);
  }

  async function registerWithUpload() {
    try {
      if (!orderId) throw new Error("Please enter an Order ID");
      if (!file) throw new Error("Please select a file to upload");
      if (!account) throw new Error("Please connect your wallet");
      if (!isSepolia) throw new Error("Please switch to Sepolia network");
      if (!DOCREG) throw new Error("Document Registry not configured");

      setBusy(true);
      setError(null);
      setUploadProgress(0);

      addLog(`Starting upload of ${file.name} (${formatFileSize(file.size)})`, 'info');

      // Request wallet connection
      await window.ethereum.request({ method: "eth_requestAccounts" });

      // Compute file hash
      const hashHex = await hashFile(file);
      addLog(`File hash computed: ${hashHex}`, 'info');

      // Upload to Web3.Storage
      const uri = await uploadToWeb3(file);
      addLog(`File uploaded to IPFS: ${uri}`, 'success');

      // Register on blockchain
      const signer = await provider.getSigner();
      const reg = await getReg(signer);
      
      addLog("Registering document on blockchain...", 'info');
      const tx = await reg.registerDocument(Number(orderId), Number(docType), hashHex, uri);
      addLog(`Transaction sent: ${tx.hash}`, 'info');
      
      const receipt = await tx.wait();
      addLog(`Document registered successfully! Block: ${receipt.blockNumber}`, 'success');
      
      await refresh();
      setFile(null);
      setUploadProgress(0);
    } catch (e) {
      const errorMsg = e.message || String(e);
      addLog(`Upload error: ${errorMsg}`, 'error');
      setError(errorMsg);
    } finally {
      setBusy(false);
    }
  }

  async function registerWithCid() {
    try {
      if (!orderId) throw new Error("Please enter an Order ID");
      if (!file) throw new Error("Please select a file to compute hash");
      if (!manualCid) throw new Error("Please enter a CID");
      if (!account) throw new Error("Please connect your wallet");
      if (!isSepolia) throw new Error("Please switch to Sepolia network");
      if (!DOCREG) throw new Error("Document Registry not configured");

      setBusy(true);
      setError(null);

      await window.ethereum.request({ method: "eth_requestAccounts" });

      const hashHex = await hashFile(file);
      addLog(`File hash computed: ${hashHex}`, 'info');

      const uri = manualCid.startsWith("ipfs://") ? manualCid : `ipfs://${manualCid.trim()}`;
      addLog(`Using existing CID: ${uri}`, 'info');

      const signer = await provider.getSigner();
      const reg = await getReg(signer);
      
      const tx = await reg.registerDocument(Number(orderId), Number(docType), hashHex, uri);
      addLog(`Transaction sent: ${tx.hash}`, 'info');
      
      const receipt = await tx.wait();
      addLog(`Document registered successfully! Block: ${receipt.blockNumber}`, 'success');
      
      await refresh();
      setManualCid("");
    } catch (e) {
      const errorMsg = e.message || String(e);
      addLog(`Registration error: ${errorMsg}`, 'error');
      setError(errorMsg);
    } finally {
      setBusy(false);
    }
  }

  async function accept(index) {
    try {
      setBusy(true);
      setError(null);
      
      const signer = await provider.getSigner();
      const reg = await getReg(signer);
      
      const tx = await reg.acceptDocument(Number(orderId), Number(index));
      addLog(`Accept transaction sent: ${tx.hash}`, 'info');
      
      await tx.wait();
      addLog(`Document ${index} accepted successfully`, 'success');
      
      await refresh();
    } catch (e) {
      const errorMsg = e.message || String(e);
      addLog(`Accept error: ${errorMsg}`, 'error');
      setError(errorMsg);
    } finally {
      setBusy(false);
    }
  }

  async function reject(index) {
    try {
      setBusy(true);
      setError(null);
      
      const signer = await provider.getSigner();
      const reg = await getReg(signer);
      
      const tx = await reg.rejectDocument(Number(orderId), Number(index));
      addLog(`Reject transaction sent: ${tx.hash}`, 'info');
      
      await tx.wait();
      addLog(`Document ${index} rejected`, 'success');
      
      await refresh();
    } catch (e) {
      const errorMsg = e.message || String(e);
      addLog(`Reject error: ${errorMsg}`, 'error');
      setError(errorMsg);
    } finally {
      setBusy(false);
    }
  }

  const canDirectUpload = Boolean(WEB3_TOKEN);
  const hasRegistry = Boolean(DOCREG);

  if (!hasRegistry) {
    return (
      <div style={{ 
        marginTop: 16, 
        padding: 16, 
        border: "1px solid #f59e0b", 
        borderRadius: 12,
        background: "#fef3c7"
      }}>
        <h2 style={{ margin: 0, marginBottom: 8, color: "#92400e" }}>
          Document Registry Not Configured
        </h2>
        <p style={{ color: "#92400e", margin: 0 }}>
          The Document Registry contract address is not configured. 
          Please set REACT_APP_DOCREG_ADDRESS environment variable.
        </p>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 16, padding: 16, border: "1px solid #e5e7eb", borderRadius: 12, background: "white" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>Document Management</h2>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ 
            width: 8, 
            height: 8, 
            borderRadius: "50%", 
            background: eblAccepted ? "#16a34a" : "#dc2626" 
          }} />
          <span style={{ fontSize: 14, fontWeight: 600 }}>
            eBL Status: {eblAccepted ? "ACCEPTED" : "PENDING"}
          </span>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div style={{ 
          background: "#fef2f2", 
          border: "1px solid #fecaca", 
          borderRadius: 8, 
          padding: 12, 
          marginBottom: 16,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center"
        }}>
          <span style={{ color: "#dc2626", fontSize: 14 }}>{error}</span>
          <button 
            onClick={clearError}
            style={{ 
              background: "none", 
              border: "none", 
              color: "#dc2626", 
              cursor: "pointer",
              fontSize: 18
            }}
          >
            ×
          </button>
        </div>
      )}

      {/* Upload Form */}
      <div style={{ 
        background: "#f8f9fa", 
        border: "1px solid #e9ecef", 
        borderRadius: 8, 
        padding: 16, 
        marginBottom: 16 
      }}>
        <h3 style={{ margin: "0 0 12px 0", fontSize: 16 }}>Upload Document</h3>
        
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
              Order ID
            </label>
            <input 
              value={orderId} 
              onChange={e => setOrderId(e.target.value)} 
              placeholder="e.g. 1" 
              style={{ 
                width: "100%", 
                padding: 8, 
                border: "1px solid #d1d5db", 
                borderRadius: 6,
                fontSize: 14
              }}
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
              Document Type
            </label>
            <select 
              value={docType} 
              onChange={e => setDocType(Number(e.target.value))}
              style={{ 
                width: "100%", 
                padding: 8, 
                border: "1px solid #d1d5db", 
                borderRadius: 6,
                fontSize: 14
              }}
            >
              {Object.entries(DocTypeLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
            File {file && `(${formatFileSize(file.size)})`}
          </label>
          <input 
            type="file" 
            onChange={e => setFile(e.target.files?.[0] || null)}
            style={{ 
              width: "100%", 
              padding: 8, 
              border: "1px solid #d1d5db", 
              borderRadius: 6,
              fontSize: 14
            }}
          />
        </div>

        {!canDirectUpload && (
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
              IPFS CID (from Web3.Storage console)
            </label>
            <input 
              value={manualCid} 
              onChange={e => setManualCid(e.target.value)} 
              placeholder="bafy..." 
              style={{ 
                width: "100%", 
                padding: 8, 
                border: "1px solid #d1d5db", 
                borderRadius: 6,
                fontSize: 14
              }}
            />
          </div>
        )}

        {/* Upload Progress */}
        {uploadProgress > 0 && uploadProgress < 100 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontSize: 12, color: "#666" }}>Upload Progress</span>
              <span style={{ fontSize: 12, color: "#666" }}>{Math.round(uploadProgress)}%</span>
            </div>
            <div style={{ 
              width: "100%", 
              height: 6, 
              background: "#e5e7eb", 
              borderRadius: 3,
              overflow: "hidden"
            }}>
              <div style={{
                width: `${uploadProgress}%`,
                height: "100%",
                background: "#3b82f6",
                transition: "width 0.3s ease"
              }} />
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <button 
            onClick={refresh} 
            disabled={busy || !orderId}
            style={{
              padding: "8px 16px",
              background: "#6b7280",
              color: "white",
              border: "none",
              borderRadius: 6,
              cursor: busy || !orderId ? "not-allowed" : "pointer",
              fontSize: 14,
              opacity: busy || !orderId ? 0.5 : 1
            }}
          >
            {busy ? "Loading..." : "Refresh"}
          </button>

          {canDirectUpload ? (
            <>
              <button 
                onClick={registerWithUpload} 
                disabled={busy || !orderId || !file}
                style={{
                  padding: "8px 16px",
                  background: "#16a34a",
                  color: "white",
                  border: "none",
                  borderRadius: 6,
                  cursor: busy || !orderId || !file ? "not-allowed" : "pointer",
                  fontSize: 14,
                  opacity: busy || !orderId || !file ? 0.5 : 1
                }}
              >
                {busy ? "Uploading..." : "Upload + Register"}
              </button>
              <span style={{ color: "#666", fontSize: 14 }}>or</span>
              <input 
                placeholder="Paste CID to register existing file" 
                value={manualCid} 
                onChange={e => setManualCid(e.target.value)} 
                style={{ 
                  padding: "8px 12px", 
                  border: "1px solid #d1d5db", 
                  borderRadius: 6,
                  fontSize: 14,
                  minWidth: 200
                }} 
              />
              <button 
                onClick={registerWithCid} 
                disabled={busy || !orderId || !file || !manualCid}
                style={{
                  padding: "8px 16px",
                  background: "#3b82f6",
                  color: "white",
                  border: "none",
                  borderRadius: 6,
                  cursor: busy || !orderId || !file || !manualCid ? "not-allowed" : "pointer",
                  fontSize: 14,
                  opacity: busy || !orderId || !file || !manualCid ? 0.5 : 1
                }}
              >
                Register with CID
              </button>
            </>
          ) : (
            <button 
              onClick={registerWithCid} 
              disabled={busy || !orderId || !file || !manualCid}
              style={{
                padding: "8px 16px",
                background: "#3b82f6",
                color: "white",
                border: "none",
                borderRadius: 6,
                cursor: busy || !orderId || !file || !manualCid ? "not-allowed" : "pointer",
                fontSize: 14,
                opacity: busy || !orderId || !file || !manualCid ? 0.5 : 1
              }}
            >
              Register with CID
            </button>
          )}
        </div>
      </div>

      {/* Documents Table */}
      <div>
        <h3 style={{ margin: "0 0 12px 0", fontSize: 16 }}>
          Documents for Order {orderId || "—"}
        </h3>
        
        {docs.length === 0 ? (
          <div style={{ 
            textAlign: "center", 
            padding: 24, 
            color: "#666",
            background: "#f8f9fa",
            borderRadius: 8,
            border: "1px solid #e9ecef"
          }}>
            No documents found for this order.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ 
              width: "100%", 
              borderCollapse: "collapse",
              fontSize: 14
            }}>
              <thead>
                <tr style={{ background: "#f8f9fa" }}>
                  <th style={{ padding: 12, textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>#</th>
                  <th style={{ padding: 12, textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>Type</th>
                  <th style={{ padding: 12, textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>Hash</th>
                  <th style={{ padding: 12, textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>IPFS Link</th>
                  <th style={{ padding: 12, textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>Uploader</th>
                  <th style={{ padding: 12, textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>Uploaded</th>
                  <th style={{ padding: 12, textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>Status</th>
                  <th style={{ padding: 12, textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {docs.map(d => (
                  <tr key={d.index} style={{ borderBottom: "1px solid #f3f4f6" }}>
                    <td style={{ padding: 12 }}>{d.index}</td>
                    <td style={{ padding: 12 }}>
                      <span style={{ 
                        padding: "2px 8px", 
                        borderRadius: 4, 
                        fontSize: 12,
                        background: d.type === DocType.EBL ? "#dbeafe" : "#f3f4f6",
                        color: d.type === DocType.EBL ? "#1e40af" : "#374151"
                      }}>
                        {DocTypeLabels[d.type] || `Type ${d.type}`}
                      </span>
                    </td>
                    <td style={{ padding: 12, fontFamily: "monospace", fontSize: 12 }}>
                      <span title={String(d.hash)}>
                        {String(d.hash).slice(0, 10)}...
                      </span>
                    </td>
                    <td style={{ padding: 12 }}>
                      {d.uri?.startsWith("ipfs://") ? (
                        <a 
                          href={`https://w3s.link/ipfs/${d.uri.replace("ipfs://", "")}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          style={{ 
                            color: "#3b82f6", 
                            textDecoration: "none",
                            fontSize: 12
                          }}
                        >
                          View Document →
                        </a>
                      ) : (
                        <span style={{ color: "#666", fontSize: 12 }}>N/A</span>
                      )}
                    </td>
                    <td style={{ padding: 12, fontSize: 12 }}>
                      <span title={d.uploader}>
                        {formatAddress(d.uploader)}
                      </span>
                    </td>
                    <td style={{ padding: 12, fontSize: 12 }}>
                      {formatTimestamp(d.uploadedAt)}
                    </td>
                    <td style={{ padding: 12 }}>
                      <div style={{ display: "flex", gap: 4 }}>
                        {d.accepted && (
                          <span style={{ 
                            padding: "2px 6px", 
                            borderRadius: 4, 
                            fontSize: 11,
                            background: "#dcfce7",
                            color: "#166534"
                          }}>
                            ACCEPTED
                          </span>
                        )}
                        {d.rejected && (
                          <span style={{ 
                            padding: "2px 6px", 
                            borderRadius: 4, 
                            fontSize: 11,
                            background: "#fef2f2",
                            color: "#dc2626"
                          }}>
                            REJECTED
                          </span>
                        )}
                        {!d.accepted && !d.rejected && (
                          <span style={{ 
                            padding: "2px 6px", 
                            borderRadius: 4, 
                            fontSize: 11,
                            background: "#fef3c7",
                            color: "#92400e"
                          }}>
                            PENDING
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: 12 }}>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button 
                          onClick={() => accept(d.index)} 
                          disabled={busy || d.accepted}
                          style={{
                            padding: "4px 8px",
                            background: d.accepted ? "#d1d5db" : "#16a34a",
                            color: d.accepted ? "#6b7280" : "white",
                            border: "none",
                            borderRadius: 4,
                            cursor: busy || d.accepted ? "not-allowed" : "pointer",
                            fontSize: 12
                          }}
                        >
                          Accept
                        </button>
                        <button 
                          onClick={() => reject(d.index)} 
                          disabled={busy || d.rejected}
                          style={{
                            padding: "4px 8px",
                            background: d.rejected ? "#d1d5db" : "#dc2626",
                            color: d.rejected ? "#6b7280" : "white",
                            border: "none",
                            borderRadius: 4,
                            cursor: busy || d.rejected ? "not-allowed" : "pointer",
                            fontSize: 12
                          }}
                        >
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Activity Log */}
      <div style={{ marginTop: 16 }}>
        <div style={{ 
          display: "flex", 
          justifyContent: "space-between", 
          alignItems: "center", 
          marginBottom: 8 
        }}>
          <h4 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Activity Log</h4>
          <button 
            onClick={() => setLog([])}
            style={{
              padding: "4px 8px",
              background: "#6b7280",
              color: "white",
              border: "none",
              borderRadius: 4,
              cursor: "pointer",
              fontSize: 12
            }}
          >
            Clear
          </button>
        </div>
        <div style={{ 
          whiteSpace: "pre-wrap", 
          fontFamily: "monospace", 
          border: "1px solid #e5e7eb", 
          borderRadius: 8, 
          padding: 12, 
          maxHeight: 200, 
          overflowY: "auto", 
          background: "#f8f9fa",
          fontSize: 12
        }}>
          {log.length ? log.map((entry, i) => (
            <div key={i} style={{ 
              color: entry.type === 'error' ? '#dc2626' : 
                     entry.type === 'success' ? '#16a34a' : '#374151',
              marginBottom: 4
            }}>
              {entry.message}
            </div>
          )) : "No activity yet..."}
        </div>
      </div>
    </div>
  );
}
