export enum IDs {
  Auth = 'auth',
  ReAuth = 're_auth',
  GetOrderState = 'gos',
  AccSummaries = 'acc_summaries',
}

export enum AccSummaryIDs {
  AccountSummaryBtc = 'acc_summary/BTC',
  AccountSummaryEth = 'acc_summary/ETH',
  AccountSummaryUsdc = 'acc_summary/USDC',
  AccountSummaryUsdt = 'acc_summary/USDT',
}

export enum PublicSubscriptions {
  IndexPriceBtcUsd = 'deribit_price_index.btc_usd', // https://docs.deribit.com/#deribit_price_index-index_name
  IndexPriceEthUsd = 'deribit_price_index.eth_usd', // https://docs.deribit.com/#deribit_price_index-index_name
  TickerBtcPerpetual = 'ticker.BTC-PERPETUAL.raw',
  TickerEthPerpetual = 'ticker.ETH-PERPETUAL.raw',
  TickerBtcUsdcSpot = 'ticker.BTC_USDC.raw',
  TickerBtcUsdtSpot = 'ticker.BTC_USDT.raw',
  TickerEthUsdcSpot = 'ticker.ETH_USDC.raw',
  TickerEthUsdtSpot = 'ticker.ETH_USDT.raw',
}

export enum PrivateSubscriptions {
  PortfolioBtc = 'user.portfolio.btc',
  PortfolioEth = 'user.portfolio.eth',
  PortfolioUsdc = 'user.portfolio.usdc',
  PortfolioUsdt = 'user.portfolio.usdt',
  OrdersAnyAny = 'user.orders.any.any.raw', // 1st "any" - kind of instrument, 2nd "any" currency, https://docs.deribit.com/#user-orders-kind-currency-raw
  ChangesAnyAny = 'user.changes.any.any.raw', // 1st "any" - kind of instrument, 2nd "any" currency, https://docs.deribit.com/#user-changes-kind-currency-interval
  ChangesFutureAny = 'user.changes.future.any.raw',
  ChangesOptionAny = 'user.changes.option.any.raw',
  ChangesSpotAny = 'user.changes.spot.any.raw',
}

export type Subscriptions = PublicSubscriptions | PrivateSubscriptions;

export enum PublicMethods {
  Auth = 'public/auth',
  GetIndex = 'public/get_index',
  GetInstrument = 'public/get_instrument',
  Ticker = 'public/ticker',
  PublicSubscribe = 'public/subscribe',
}

export enum PrivateMethods {
  AccountSummary = 'private/get_account_summary',
  AccountSummaries = 'private/get_account_summaries',
  PrivateSubscribe = 'private/subscribe',
  GetOrderState = 'private/get_order_state',
}

export type Methods = PublicMethods | PrivateMethods;

type RpcIDs = IDs | PublicSubscriptions | PrivateSubscriptions | AccSummaryIDs | string; // open_order() has id like `o/${order_id}`;

export type RpcError = {
  code: number;
  message: string;
};

interface RpcMsg {
  id: RpcIDs;
  usIn: number;
  usOut: number;
  usDiff: number;
  error?: RpcError;
}

export interface RpcSubscriptionMsg extends RpcMsg {
  method: 'subscription';
  params: SubscriptionParams;
}

export enum Currencies {
  BTC = 'BTC',
  ETH = 'ETH',
  USDC = 'USDC',
  USDT = 'USDT',
}

export enum Instruments {
  BTC_PERPETUAL = 'BTC-PERPETUAL',
  ETH_PERPETUAL = 'ETH-PERPETUAL',
}

export enum Kinds {
  future = 'future',
  option = 'option',
  spot = 'spot',
  future_combo = 'future_combo',
  option_combo = 'option_combo',
}

export enum TimeInForce {
  GTC = 'good_til_cancelled', // default on Deribit
  GTD = 'good_til_day',
  FOK = 'fill_or_kill',
  IOK = 'immediate_or_cancel',
}

export enum OrderType {
  limit = 'limit', // default on Deribit
  market = 'market',
  liquidation = 'liquidation', // only in trades, unable to pass in outgoing order
}

export type OrderStates =
  | 'open' // Deribit state
  | 'filled' // Deribit state
  | 'rejected' // Deribit state
  | 'cancelled'; // Deribit state

export enum OrderDirections {
  buy = 'buy',
  sell = 'sell',
}

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
  instrument_name: Instruments;
  filled_amount: number;
  direction: OrderDirections;
  creation_timestamp?: number;
  average_price?: number;
  api?: boolean;
  amount: number;
}

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
  instrument_name: Instruments;
  index_price: number;
  fee_currency: Currencies;
  fee: number;
  direction: OrderDirections;
  amount: number;
}

export interface Position {
  average_price: number;
  delta: number;
  direction: OrderDirections | 'zero';
  estimated_liquidation_price: number;
  floating_profit_loss: number;
  index_price: number;
  initial_margin: number;
  instrument_name: Instruments;
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

export interface OrderParams {
  instrument_name: Instruments;
  amount: number;
  type: OrderType;
  price?: number;
  time_in_force: TimeInForce;
  direction: OrderDirections;
}

export interface OrderData {
  initial?: OrderParams;
  is_pending: boolean;
  is_error: boolean;
  rpc_error_message?: RpcMsg;
  order_rpc_message_results: Order[];
  state: null | OrderStates;
}

export interface SubscriptionParams {
  channel: Subscriptions;
  data: BTCIndexData | PerpetualTickerData | UserChanges | UserPortfolioByCurrency;
}

export interface DeribitSubscription {
  method: 'subscription';
  params: SubscriptionParams;
}

export interface BTCIndexData {
  index_name: 'btc_usd';
  price: number;
  timestamp: number;
}

export interface PerpetualTickerData {
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
  instrument_name: Instruments.BTC_PERPETUAL | Instruments.ETH_PERPETUAL;
  index_price: number;
  funding_8h: number;
  estimated_delivery_price: number;
  current_funding: number;
  best_bid_price: number;
  best_bid_amount: number;
  best_ask_price: number;
  best_ask_amount: number;
}

// https://docs.deribit.com/#user-changes-kind-currency-interval
export interface UserChanges {
  instrument_name: Instruments;
  trades: Trade[];
  positions: Position[];
  orders: Order[];
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

export interface Portfolio {
  BTC: null | UserPortfolioByCurrency;
  ETH: null | UserPortfolioByCurrency;
  USDC: null | UserPortfolioByCurrency;
  USDT: null | UserPortfolioByCurrency;
}

export interface AccountsSummary {
  BTC: null | AccountSummary;
  ETH: null | AccountSummary;
  USDC: null | AccountSummary;
  USDT: null | AccountSummary;
}

// https://docs.deribit.com/#private-get_account_summary
// todo finalize structure
export interface AccountSummary {
  delta_total_map: {
    btc_usd: any;
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

export interface RpcAuthMsg extends RpcMsg {
  id: IDs.Auth | IDs.ReAuth;
  result: {
    token_type: string;
    scope: string;
    refresh_token: string;
    expires_in: number;
    access_token: string;
  };
}

export interface RpcSubscribedMsg extends RpcMsg {
  id: Subscriptions;
  result: Subscriptions[];
}

// https://docs.deribit.com/#private-buy
// https://docs.deribit.com/#private-sell
export interface RpcOpenOrderMsg extends RpcMsg {
  id: string;
  result: {
    trades: Trade[];
    order: Order;
  };
}

export interface RpcAccSummaryMsg extends RpcMsg {
  id: AccSummaryIDs;
  result: AccountSummary;
}

export interface RpcAccSummariesMsg extends RpcMsg {
  id: IDs.AccSummaries;
  result: {
    username: string;
    type: string;
  };
}

export type RpcMessages =
  | RpcAuthMsg
  | RpcSubscribedMsg
  | RpcSubscriptionMsg
  | RpcAccSummaryMsg
  | RpcOpenOrderMsg
  | RpcAccSummariesMsg;
