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
