export enum IDs {
  Auth = 'auth',
  ReAuth = 're_auth',
}

export enum PublicSubscriptions {
  IndexPriceBtcUsd = 'deribit_price_index.btc_usd',
  IndexPriceEthUsd = 'deribit_price_index.eth_usd',
  TickerBtcPerpetual = 'ticker.BTC-PERPETUAL.raw',
  TickerEthPerpetual = 'ticker.ETH-PERPETUAL.raw',
  TickerBtcUsdcSpot = 'ticker.BTC_USDC.raw',
  TickerBtcUsdtSpot = 'ticker.BTC_USDT.raw',
  TickerEthUsdcSpot = 'ticker.ETH_USDC.raw',
  TickerEthUsdtSpot = 'ticker.ETH_USDT.raw',
}

export enum PrivateSubscriptions {

}

export type Subscriptions = PublicSubscriptions | PrivateSubscriptions;

export enum PublicMethods {
  Auth = 'public/auth',
  GetIndex = 'public/get_index',
  GetInstrument = 'public/get_instrument',
  Ticker = 'public/ticker',
  PublicSubscribe = 'public/subscribe'
}

export enum PrivateMethods {
  PrivateSubscribe = 'private/subscribe'
}

export type Methods = PublicMethods | PrivateMethods;

type RpcIDs = IDs | PublicSubscriptions | PrivateSubscriptions;

export type RpcError = {
  code: number
  message: string
}

interface RpcMsg {
  id: RpcIDs
  usIn: number,
  usOut: number,
  usDiff: number,
  error?: RpcError
}

export enum Currencies {
  BTC = 'BTC',
  ETH = 'ETH',
  USDC = 'USDC',
  USDT = 'USDT'
}

export enum Instruments {
  BTC_PERPETUAL = 'BTC-PERPETUAL',
  ETH_PERPETUAL = 'ETH-PERPETUAL'
}

export enum Kinds {
  future = 'future',
  option = 'option',
  spot = 'spot',
  future_combo = 'future_combo',
  option_combo = 'option_combo'
}

export enum TimeInForce {
  GTC = 'good_til_cancelled', // default on Deribit
  GTD = 'good_til_day',
  FOK = 'fill_or_kill',
  IOK = 'immediate_or_cancel'
}

export enum OrderType {
  limit = 'limit', // default on Deribit
  market = 'market',
  liquidation = 'liquidation' // only in trades, unable to pass in outgoing order
}

export type OrderStates =
  'open' |     // Deribit state
  'filled' |   // Deribit state
  'rejected' | // Deribit state
  'cancelled'  // Deribit state

export enum OrderDirections {
  buy = 'buy',
  sell = 'sell'
}

export interface Order {
  time_in_force: TimeInForce
  reduce_only?: boolean
  price?: number
  post_only?: boolean
  order_type: OrderType
  order_state: OrderStates
  order_id: string
  max_show?: number
  last_update_timestamp: number
  label: string
  is_rebalance?: boolean
  is_liquidation?: boolean
  instrument_name: Instruments
  filled_amount: number
  direction: OrderDirections
  creation_timestamp?: number
  average_price?: number
  api?: boolean
  amount: number
}

export interface Trade {
  trade_seq: number
  trade_id: string
  timestamp: number
  tick_direction: 0 | 1 | 2 | 3 // 0 = Plus Tick, 1 = Zero-Plus Tick, 2 = Minus Tick, 3 = Zero-Minus Tick
  state: OrderStates
  reduce_only: boolean
  price: number
  post_only: boolean
  order_type: OrderType
  order_id: string
  matching_id: null
  mark_price: number
  liquidity: 'M' | 'T' // "M" when it was maker order, "T" when it was taker order
  label: string
  instrument_name: Instruments
  index_price: number
  fee_currency: Currencies
  fee: number
  direction: OrderDirections
  amount: number
}

export interface Position {
  average_price: number
  delta: number
  direction: OrderDirections | 'zero'
  estimated_liquidation_price: number
  floating_profit_loss: number
  index_price: number
  initial_margin: number
  instrument_name: Instruments
  interest_value : number
  kind: Kinds
  leverage: number
  maintenance_margin: number
  mark_price: number
  open_orders_margin: number
  realized_funding: number
  realized_profit_loss: number
  settlement_price: number
  size: number
  size_currency: number
  total_profit_loss: number
}



export interface SubscriptionParams {
  channel: Subscriptions,
  data: BTCIndexData | PerpetualTickerData | UserChanges | UserPortfolio
}

export interface DeribitSubscription {
  method: 'subscription'
  params: SubscriptionParams
}

export interface BTCIndexData {
  index_name: 'btc_usd'
  price: number
  timestamp: number
}

export interface PerpetualTickerData {
  timestamp: number,
  stats: {
    volume_usd: number,
    volume: number,
    price_change: number,
    low: number,
    high: number
  },
  state: string,
  settlement_price: number,
  open_interest: number,
  min_price: number,
  max_price: number,
  mark_price: number,
  last_price: number,
  interest_value: number,
  instrument_name: Instruments.BTC_PERPETUAL | Instruments.ETH_PERPETUAL,
  index_price: number,
  funding_8h: number,
  estimated_delivery_price: number,
  current_funding: number,
  best_bid_price: number,
  best_bid_amount: number,
  best_ask_price: number,
  best_ask_amount: number
}

export interface UserChanges {
  // https://docs.deribit.com/#user-changes-kind-currency-interval
  instrument_name: Instruments
  trades: Trade[]
  positions: Position[]
  orders: Order[]
}

export interface UserPortfolio {
  // describe
  // https://docs.deribit.com/#user-portfolio-currency
}

export interface RpcAuthMsg extends RpcMsg {
  id: IDs.Auth | IDs.ReAuth
  result: {
    token_type: string,
    scope: string,
    refresh_token: string,
    expires_in: number,
    access_token: string
  },
}

export interface RpcSubscribedMsg extends RpcMsg {
  id: Subscriptions
  result: Subscriptions[]
}

export type RpcMessages = RpcAuthMsg | RpcSubscribedMsg;
