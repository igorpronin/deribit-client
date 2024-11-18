import {
  Order,
  UserPortfolioByCurrency,
  Indexes,
  Trade,
  Position,
  AccountSummary,
  Instrument,
  CurrencyData,
} from './deribit_objects';
export * from './deribit_objects';

export enum IDs {
  Auth = 'auth',
  ReAuth = 're_auth',
  GetOrderState = 'gos',
  AccSummaries = 'acc_summaries',
  GetCurrencies = 'get_currencies',
  GetPositions = 'get_positions',
  GetTransactionLog = 'get_transaction_log',
}

export type GetInstrumentID = `get_instruments/${Kinds}`;

export type AccSummaryID = `acc_summary/${Currencies}`;

// https://docs.deribit.com/#deribit_price_index-index_name
export type PublicIndexSubscription = `deribit_price_index.${string}`;

// https://docs.deribit.com/#ticker-instrument_name-interval
export type PublicTickerSubscription = `ticker.${string}.raw`;

// https://docs.deribit.com/#book-instrument_name-interval
export type PublicBookSubscription = `book.${string}.raw`;

// https://docs.deribit.com/#subscriptions
export type PublicSubscription =
  | PublicIndexSubscription
  | PublicTickerSubscription
  | PublicBookSubscription;

// https://docs.deribit.com/#subscriptions
export type PrivateSubscription =
  | `user.portfolio.${CurrenciesLowerCase}`
  | 'user.portfolio.any'
  | 'user.changes.any.any.raw';

// OrdersAnyAny = 'user.orders.any.any.raw', // 1st "any" - kind of instrument, 2nd "any" currency, https://docs.deribit.com/#user-orders-kind-currency-raw
// ChangesAnyAny = 'user.changes.any.any.raw', // 1st "any" - kind of instrument, 2nd "any" currency, https://docs.deribit.com/#user-changes-kind-currency-interval
// ChangesFutureAny = 'user.changes.future.any.raw',
// ChangesOptionAny = 'user.changes.option.any.raw',
// ChangesSpotAny = 'user.changes.spot.any.raw',

export type Subscriptions = PublicSubscription | PrivateSubscription;

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
  GetPositions = 'private/get_positions',
  GetTransactionLog = 'private/get_transaction_log',
}

export type Methods = PublicMethods | PrivateMethods;

export type Currencies =
  | 'ETHW'
  | 'STETH'
  | 'MATIC'
  | 'XRP'
  | 'EURR'
  | 'SOL'
  | 'USDT'
  | 'USDC'
  | 'ETH'
  | 'BTC';

export type CurrenciesLowerCase =
  | 'ethw'
  | 'steth'
  | 'matic'
  | 'xrp'
  | 'eurr'
  | 'sol'
  | 'usdt'
  | 'usdc'
  | 'eth'
  | 'btc';

export type Kinds = 'future' | 'option' | 'spot' | 'future_combo' | 'option_combo';

export type ScopeTitle = 'name' | 'connection' | 'trade' | 'wallet' | 'account' | 'custody';
export type Scope = 'read_write' | 'read' | 'none';

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

export type OrderDirections = 'buy' | 'sell';

export interface OrderParams {
  instrument_name: string;
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
  trades: Trade[];
  closed_timestamp: number | null;
  average_price: number | null;
  traded_amount: number | null;
  total_fee: number | null;
}

export type SubscriptionData =
  | BTCIndexData
  | UserChanges
  | UserPortfolioByCurrency
  | BookSubscriptionData;

export interface SubscriptionParams {
  channel: Subscriptions;
  data: SubscriptionData;
}

export interface DeribitSubscription {
  method: 'subscription';
  params: SubscriptionParams;
}

export interface BTCIndexData {
  index_name: Indexes;
  price: number;
  timestamp: number;
}

type ChangeType = 'new' | 'change' | 'delete';

export interface BookSubscriptionData {
  type: 'snapshot' | 'change';
  timestamp: number;
  instrument_name: string;
  bids: [change_type: ChangeType, price: number, amount: number][];
  asks: [change_type: ChangeType, price: number, amount: number][];
}

// https://docs.deribit.com/#user-changes-kind-currency-interval
export interface UserChanges {
  instrument_name: string;
  trades: Trade[];
  positions: Position[];
  orders: Order[];
}

export interface RpcAuthMsg extends RpcSuccessResponse {
  id: IDs.Auth | IDs.ReAuth;
  result: {
    token_type: string;
    scope: string;
    refresh_token: string;
    expires_in: number;
    access_token: string;
  };
}

export interface RpcSubscribedMsg extends RpcSuccessResponse {
  id: Subscriptions;
  result: Subscriptions[];
}

// https://docs.deribit.com/#private-buy
// https://docs.deribit.com/#private-sell
export interface RpcOpenOrderMsg extends RpcSuccessResponse {
  id: `o/${string}`;
  result: {
    trades: Trade[];
    order: Order;
  };
}

export interface RpcAccSummaryMsg extends RpcSuccessResponse {
  id: AccSummaryID;
  result: AccountSummary;
}

// https://docs.deribit.com/#private-get_account_summaries
export interface RpcAccSummariesMsg extends RpcSuccessResponse {
  id: IDs.AccSummaries;
  result: {
    id: number;
    username: string;
    type: string;
    summaries: AccountSummary[];
  };
}

export interface RpcGetInstrumentsMsg extends RpcSuccessResponse {
  id: GetInstrumentID;
  result: Instrument[];
}

export interface RpcGetCurrenciesMsg extends RpcSuccessResponse {
  id: IDs.GetCurrencies;
  result: CurrencyData[];
}

export interface RpcGetPositionsMsg extends RpcSuccessResponse {
  id: IDs.GetPositions;
  result: Position[];
}

// Root types and interfaces

export type RpcError = {
  code: number;
  message: string;
};

export interface RpcErrorResponse extends RpcMsg {
  error: RpcError;
}

export interface RpcSuccessResponse extends RpcMsg {
  result: any;
}

export interface RpcSubscriptionMessage extends RpcMsg {
  method: 'subscription';
  params: SubscriptionParams;
}

export interface RpcMsg {
  id: string;
  usIn: number;
  usOut: number;
  usDiff: number;
}

export type RpcResponseMessage = RpcSuccessResponse | RpcErrorResponse;

export type RpcMessage = RpcResponseMessage | RpcSubscriptionMessage;
