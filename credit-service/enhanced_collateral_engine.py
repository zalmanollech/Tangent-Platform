# Enhanced Multi-Layer Collateral Risk Engine

class EnhancedCollateralEngine:
    """Advanced collateral engine with multi-layer protection analysis"""
    
    def __init__(self):
        # Inventory haircuts by type and quality
        self.inventory_haircuts = {
            'commodity': {
                'exchange_traded': {
                    'A': 0.05,  # 5% haircut for exchange-traded A-grade
                    'B': 0.10,  # 10% haircut for exchange-traded B-grade
                    'C': 0.15   # 15% haircut for exchange-traded C-grade
                },
                'otc': {
                    'A': 0.15,  # 15% haircut for OTC A-grade
                    'B': 0.25,  # 25% haircut for OTC B-grade
                    'C': 0.35   # 35% haircut for OTC C-grade
                }
            },
            'finished_goods': {
                'high_demand': 0.20,    # 20% haircut
                'medium_demand': 0.30,  # 30% haircut
                'low_demand': 0.45      # 45% haircut
            },
            'raw_materials': {
                'standard': 0.25,       # 25% haircut
                'specialized': 0.35,    # 35% haircut
                'perishable': 0.50      # 50% haircut
            }
        }
        
        # Exchange quality scores
        self.exchange_scores = {
            'CME': 0.95,      # Chicago Mercantile Exchange
            'LME': 0.90,      # London Metal Exchange
            'NYMEX': 0.90,    # New York Mercantile Exchange
            'ICE': 0.85,      # Intercontinental Exchange
            'SGX': 0.80,      # Singapore Exchange
            'DEFAULT': 0.70   # Default exchange score
        }
        
        # Buyer quality impact on collateral
        self.buyer_quality_multipliers = {
            'excellent': 1.0,    # No additional haircut
            'good': 0.95,        # 5% additional protection
            'fair': 0.90,        # 10% additional protection
            'poor': 0.80,        # 20% additional haircut
            'unknown': 0.85      # 15% additional haircut
        }
        
        # Location risk factors
        self.location_risk = {
            'warehouse_secured': 0.0,      # No additional risk
            'warehouse_unsecured': 0.05,   # 5% additional risk
            'port': 0.03,                 # 3% additional risk
            'field': 0.10,                # 10% additional risk
            'transit': 0.15,               # 15% additional risk
            'unknown': 0.08                # 8% additional risk
        }
    
    def calculate_multi_layer_protection(self, trade_data, entity_data=None):
        """Calculate comprehensive multi-layer protection analysis"""
        
        protection_layers = {}
        
        # Layer 1: Inventory Analysis
        inventory_protection = self._analyze_inventory_protection(trade_data)
        protection_layers['inventory'] = inventory_protection
        
        # Layer 2: Deposit Analysis
        deposit_protection = self._analyze_deposit_protection(trade_data)
        protection_layers['deposits'] = deposit_protection
        
        # Layer 3: Buyer Quality Analysis
        buyer_protection = self._analyze_buyer_protection(trade_data, entity_data)
        protection_layers['buyer'] = buyer_protection
        
        # Layer 4: Exchange Trading Analysis
        exchange_protection = self._analyze_exchange_protection(trade_data)
        protection_layers['exchange'] = exchange_protection
        
        # Calculate combined protection
        combined_protection = self._combine_protection_layers(protection_layers, trade_data)
        
        return {
            'protection_layers': protection_layers,
            'combined_protection': combined_protection,
            'total_protection_value': combined_protection['total_protection_value'],
            'effective_protection_ratio': combined_protection['effective_protection_ratio'],
            'risk_reduction': combined_protection['risk_reduction'],
            'lgd_adjustment': combined_protection['lgd_adjustment'],
            'pd_adjustment_factor': combined_protection['pd_adjustment_factor']
        }
    
    def _analyze_inventory_protection(self, trade_data):
        """Analyze inventory as collateral"""
        
        inventory_value = trade_data.get('inventory_value', 0)
        inventory_type = trade_data.get('inventory_type', 'commodity')
        inventory_location = trade_data.get('inventory_location', 'unknown')
        is_exchange_traded = trade_data.get('is_exchange_traded', False)
        exchange_grade = trade_data.get('exchange_grade', 'B')
        
        if inventory_value <= 0:
            return {
                'value': 0,
                'haircut_rate': 0,
                'net_value': 0,
                'protection_score': 0,
                'details': 'No inventory collateral'
            }
        
        # Determine haircut based on type and trading status
        if inventory_type == 'commodity':
            if is_exchange_traded:
                haircut_rate = self.inventory_haircuts['commodity']['exchange_traded'].get(exchange_grade, 0.10)
            else:
                haircut_rate = self.inventory_haircuts['commodity']['otc'].get(exchange_grade, 0.25)
        else:
            # For finished goods and raw materials, use demand/type based haircuts
            demand_level = trade_data.get('demand_level', 'medium_demand')
            haircut_rate = self.inventory_haircuts[inventory_type].get(demand_level, 0.30)
        
        # Add location risk
        location_risk = self.location_risk.get(inventory_location, 0.08)
        total_haircut = min(haircut_rate + location_risk, 0.60)  # Cap at 60%
        
        net_value = inventory_value * (1 - total_haircut)
        protection_score = min(net_value / trade_data.get('amount', 1), 1.0)
        
        return {
            'value': inventory_value,
            'haircut_rate': total_haircut,
            'net_value': net_value,
            'protection_score': protection_score,
            'details': f'{inventory_type} inventory, {exchange_grade if is_exchange_traded else "OTC"} grade, {inventory_location} location'
        }
    
    def _analyze_deposit_protection(self, trade_data):
        """Analyze cash deposits as collateral"""
        
        buyer_deposit = trade_data.get('buyer_deposit', 0)
        supplier_deposit = trade_data.get('supplier_deposit', 0)
        
        # Cash deposits have minimal haircut (only currency risk)
        cash_haircut = 0.01  # 1% for currency risk
        
        total_deposits = buyer_deposit + supplier_deposit
        net_deposit_value = total_deposits * (1 - cash_haircut)
        
        protection_score = min(net_deposit_value / trade_data.get('amount', 1), 1.0)
        
        return {
            'buyer_deposit': buyer_deposit,
            'supplier_deposit': supplier_deposit,
            'total_deposits': total_deposits,
            'haircut_rate': cash_haircut,
            'net_value': net_deposit_value,
            'protection_score': protection_score,
            'details': f'Cash deposits: Buyer ${buyer_deposit:,.0f}, Supplier ${supplier_deposit:,.0f}'
        }
    
    def _analyze_buyer_protection(self, trade_data, entity_data):
        """Analyze buyer quality impact on collateral"""
        
        has_buyer = trade_data.get('has_buyer', False)
        buyer_quality_score = trade_data.get('buyer_quality_score', 0.5)
        buyer_entity_id = trade_data.get('buyer_entity_id')
        
        if not has_buyer or buyer_quality_score <= 0:
            return {
                'has_buyer': False,
                'quality_score': 0,
                'protection_multiplier': 1.0,
                'details': 'No buyer or buyer quality unknown'
            }
        
        # Determine buyer quality category
        if buyer_quality_score >= 0.8:
            quality_category = 'excellent'
        elif buyer_quality_score >= 0.6:
            quality_category = 'good'
        elif buyer_quality_score >= 0.4:
            quality_category = 'fair'
        elif buyer_quality_score >= 0.2:
            quality_category = 'poor'
        else:
            quality_category = 'unknown'
        
        protection_multiplier = self.buyer_quality_multipliers[quality_category]
        
        return {
            'has_buyer': True,
            'buyer_entity_id': buyer_entity_id,
            'quality_score': buyer_quality_score,
            'quality_category': quality_category,
            'protection_multiplier': protection_multiplier,
            'details': f'Buyer quality: {quality_category} ({buyer_quality_score:.1%})'
        }
    
    def _analyze_exchange_protection(self, trade_data):
        """Analyze exchange trading impact on collateral"""
        
        is_exchange_traded = trade_data.get('is_exchange_traded', False)
        exchange_name = trade_data.get('exchange_name', 'DEFAULT')
        
        if not is_exchange_traded:
            return {
                'is_exchange_traded': False,
                'exchange_score': 0,
                'liquidity_benefit': 0,
                'details': 'Not exchange traded - OTC market'
            }
        
        exchange_score = self.exchange_scores.get(exchange_name, 0.70)
        liquidity_benefit = exchange_score * 0.1  # Up to 10% additional protection
        
        return {
            'is_exchange_traded': True,
            'exchange_name': exchange_name,
            'exchange_score': exchange_score,
            'liquidity_benefit': liquidity_benefit,
            'details': f'Exchange traded on {exchange_name} (score: {exchange_score:.1%})'
        }
    
    def _combine_protection_layers(self, protection_layers, trade_data):
        """Combine all protection layers into final assessment"""
        
        trade_amount = trade_data.get('amount', 0)
        
        # Get individual protection values
        inventory_net = protection_layers['inventory']['net_value']
        deposit_net = protection_layers['deposits']['net_value']
        
        # Apply buyer quality multiplier to inventory
        buyer_multiplier = protection_layers['buyer']['protection_multiplier']
        adjusted_inventory = inventory_net * buyer_multiplier
        
        # Add exchange liquidity benefit
        exchange_benefit = protection_layers['exchange']['liquidity_benefit']
        liquidity_adjustment = (adjusted_inventory + deposit_net) * exchange_benefit
        
        # Calculate total protection
        total_protection_value = adjusted_inventory + deposit_net + liquidity_adjustment
        
        # Calculate ratios
        protection_ratio = total_protection_value / trade_amount if trade_amount > 0 else 0
        effective_protection_ratio = min(protection_ratio, 0.9)  # Cap at 90%
        
        # Calculate risk adjustments
        risk_reduction = min(effective_protection_ratio * 0.8, 0.7)  # Max 70% risk reduction
        
        # LGD adjustment (Loss Given Default)
        base_lgd = 0.45  # 45% base loss
        lgd_adjustment = base_lgd * (1 - risk_reduction)
        
        # PD adjustment factor
        pd_adjustment_factor = 1 - (risk_reduction * 0.6)  # Max 60% PD reduction
        
        return {
            'total_protection_value': total_protection_value,
            'effective_protection_ratio': effective_protection_ratio,
            'risk_reduction': risk_reduction,
            'lgd_adjustment': lgd_adjustment,
            'pd_adjustment_factor': pd_adjustment_factor,
            'breakdown': {
                'inventory_value': inventory_net,
                'deposit_value': deposit_net,
                'buyer_adjustment': buyer_multiplier,
                'exchange_benefit': liquidity_adjustment
            }
        }
    
    def calculate_enhanced_pd(self, base_pd, protection_analysis):
        """Calculate enhanced PD considering multi-layer protection"""
        
        pd_adjustment_factor = protection_analysis['combined_protection']['pd_adjustment_factor']
        adjusted_pd = base_pd * pd_adjustment_factor
        
        return {
            'original_pd': base_pd,
            'adjusted_pd': adjusted_pd,
            'pd_reduction': base_pd - adjusted_pd,
            'pd_reduction_pct': (base_pd - adjusted_pd) / base_pd if base_pd > 0 else 0,
            'adjustment_factor': pd_adjustment_factor
        }

