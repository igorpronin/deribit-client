import { Currencies, Kinds, TimeInForce, OrderType, OrderDirections, OrderStates } from './types';

// https://docs.deribit.com/#private-get_account_summary
// todo finalize structure
export interface AccountSummary {
  delta_total_map: {
    btc_usd: number;
  };
  margin_balance: number;
  futures_session_rpl: number;
  options_session_rpl: number;
  estimated_liquidation_ratio_map: {
    btc_usd: number;
  };
  session_upl: number;
  email: string;
  system_name: string;
  username: string;
  interuser_transfers_enabled: boolean;
  id: number;
  estimated_liquidation_ratio: number;
  options_gamma_map: {
    btc_usd: number;
  };
  options_vega: number;
  options_value: number;
  available_withdrawal_funds: number;
  projected_delta_total: number;
  maintenance_margin: number;
  total_pl: number;
  limits: {
    non_matching_engine: {
      rate: number;
      burst: number;
    };
    matching_engine: {
      rate: number;
      burst: number;
    };
  };
  options_theta_map: {
    btc_usd: number;
  };
  projected_maintenance_margin: number;
  available_funds: number;
  login_enabled: boolean;
  options_delta: number;
  balance: number;
  security_keys_enabled: boolean;
  referrer_id: null | number;
  mmp_enabled: boolean;
  equity: number;
  futures_session_upl: number;
  fee_balance: number;
  currency: Currencies;
  options_session_upl: number;
  projected_initial_margin: number;
  options_theta: number;
  creation_timestamp: number;
  self_trading_extended_to_subaccounts: boolean;
  portfolio_margining_enabled: boolean;
  cross_collateral_enabled: boolean;
  margin_model: string;
  options_vega_map: {
    btc_usd: number;
  };
  futures_pl: number;
  options_pl: number;
  type: string;
  self_trading_reject_mode: string;
  initial_margin: number;
  spot_reserve: number;
  delta_total: number;
  options_gamma: number;
  session_rpl: number;
}

// https://docs.deribit.com/#user-portfolio-currency
export interface UserPortfolioByCurrency {
  maintenance_margin: number;
  delta_total: number;
  options_session_rpl: number;
  futures_session_rpl: number;
  delta_total_map: {
    btc_usd: number;
  };
  session_upl: number;
  fee_balance: number;
  estimated_liquidation_ratio: number;
  initial_margin: number;
  options_gamma_map: {
    btc_usd: number;
  };
  futures_pl: number;
  currency: Currencies;
  options_value: number;
  projected_maintenance_margin: number;
  options_vega: number;
  session_rpl: number;
  futures_session_upl: number;
  options_session_upl: number;
  cross_collateral_enabled: boolean;
  options_theta: number;
  margin_model: 'segregated_sm';
  options_delta: number;
  options_pl: number;
  balance: number;
  additional_reserve: number;
  projected_initial_margin: number;
  available_funds: number;
  spot_reserve: number;
  projected_delta_total: number;
  portfolio_margining_enabled: boolean;
  total_pl: number;
  margin_balance: number;
  available_withdrawal_funds: number;
  equity: number;
  options_gamma: number;
  options_vega_map: any;
  estimated_liquidation_ratio_map: any;
  options_theta_map: any;
}

// https://docs.deribit.com/#ticker-instrument_name-interval
export interface TickerData {
  timestamp: number;
  stats: {
    volume_usd: number;
    volume: number;
    price_change: number;
    low: number;
    high: number;
  };
  state: string;
  settlement_price: number;
  open_interest: number;
  min_price: number;
  max_price: number;
  mark_price: number;
  last_price: number;
  interest_value: number;
  instrument_name: string;
  index_price: number;
  funding_8h?: number;
  estimated_delivery_price: number;
  current_funding: number;
  best_bid_price: number;
  best_bid_amount: number;
  best_ask_price: number;
  best_ask_amount: number;
}

// Warning:
// endpoint https://docs.deribit.com/#public-get_instrument
// doesn't return spot instruments
export interface SpotInstrument {
  kind: 'spot';
}

// https://docs.deribit.com/#public-get_instrument
export interface Instrument {
  tick_size: number;
  tick_size_steps: number[];
  taker_commission: number;
  settlement_period: string;
  settlement_currency: Currencies;
  rfq: boolean;
  quote_currency: Currencies;
  price_index: Indexes;
  min_trade_amount: number;
  max_liquidation_commission: number;
  max_leverage: number;
  maker_commission: number;
  kind: Kinds;
  is_active: boolean;
  instrument_name: string;
  instrument_id: number;
  instrument_type: string;
  expiration_timestamp: number;
  creation_timestamp: number;
  counter_currency: Currencies;
  contract_size: number;
  block_trade_tick_size: number;
  block_trade_min_trade_amount: 200000;
  block_trade_commission: 0.00025;
  base_currency: Currencies;
}

// https://docs.deribit.com/#private-get_open_orders
export interface Order {
  time_in_force: TimeInForce;
  reduce_only?: boolean;
  price?: number;
  post_only?: boolean;
  order_type: OrderType;
  order_state: OrderStates;
  order_id: string;
  max_show?: number;
  last_update_timestamp: number;
  label: string;
  is_rebalance?: boolean;
  is_liquidation?: boolean;
  instrument_name: string;
  filled_amount: number;
  direction: OrderDirections;
  creation_timestamp?: number;
  average_price?: number;
  api?: boolean;
  amount: number;
}

// https://docs.deribit.com/#private-get_user_trades_by_currency
export interface Trade {
  trade_seq: number;
  trade_id: string;
  timestamp: number;
  tick_direction: 0 | 1 | 2 | 3; // 0 = Plus Tick, 1 = Zero-Plus Tick, 2 = Minus Tick, 3 = Zero-Minus Tick
  state: OrderStates;
  reduce_only: boolean;
  price: number;
  post_only: boolean;
  order_type: OrderType;
  order_id: string;
  matching_id: null;
  mark_price: number;
  liquidity: 'M' | 'T'; // "M" when it was maker order, "T" when it was taker order
  label: string;
  instrument_name: string;
  index_price: number;
  fee_currency: Currencies;
  fee: number;
  direction: OrderDirections;
  amount: number;
}

// https://docs.deribit.com/#private-get_position
export interface Position {
  average_price: number;
  delta: number;
  direction: OrderDirections | 'zero';
  estimated_liquidation_price: number;
  floating_profit_loss: number;
  index_price: number;
  initial_margin: number;
  instrument_name: string;
  interest_value: number;
  kind: Kinds;
  leverage: number;
  maintenance_margin: number;
  mark_price: number;
  open_orders_margin: number;
  realized_funding: number;
  realized_profit_loss: number;
  settlement_price: number;
  size: number;
  size_currency: number;
  total_profit_loss: number;
}

// https://docs.deribit.com/#public-get_currencies
export interface CurrencyData {
  coin_type: string;
  currency: Currencies;
  currency_long: string;
  fee_precision: number;
  min_confirmations: number;
  min_withdrawal_fee: number;
  withdrawal_fee: number;
  withdrawal_priorities: any[];
}

// https://docs.deribit.com/#public-get_index_price
export type Indexes =
  | 'ada_usd'
  | 'algo_usd'
  | 'avax_usd'
  | 'bch_usd'
  | 'btc_usd'
  | 'doge_usd'
  | 'dot_usd'
  | 'eth_usd'
  | 'link_usd'
  | 'ltc_usd'
  | 'matic_usd'
  | 'near_usd'
  | 'shib_usd'
  | 'sol_usd'
  | 'trx_usd'
  | 'uni_usd'
  | 'usdc_usd'
  | 'xrp_usd'
  | 'ada_usdc'
  | 'bch_usdc'
  | 'algo_usdc'
  | 'avax_usdc'
  | 'btc_usdc'
  | 'doge_usdc'
  | 'dot_usdc'
  | 'eth_usdc'
  | 'link_usdc'
  | 'ltc_usdc'
  | 'matic_usdc'
  | 'near_usdc'
  | 'shib_usdc'
  | 'sol_usdc'
  | 'trx_usdc'
  | 'uni_usdc'
  | 'xrp_usdc'
  | 'ada_usdt'
  | 'algo_usdt'
  | 'avax_usdt'
  | 'bch_usdt'
  | 'bnb_usdt'
  | 'btc_usdt'
  | 'doge_usdt'
  | 'dot_usdt'
  | 'eth_usdt'
  | 'link_usdt'
  | 'ltc_usdt'
  | 'luna_usdt'
  | 'matic_usdt'
  | 'near_usdt'
  | 'shib_usdt'
  | 'sol_usdt'
  | 'trx_usdt'
  | 'uni_usdt'
  | 'xrp_usdt'
  | 'btcdvol_usdc'
  | 'ethdvol_usdc';
