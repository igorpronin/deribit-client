import WebSocket from 'ws';
import {
  IDs,
  AccSummaryIDs,
  Currencies,
  PrivateMethods,
  PrivateSubscriptions,
  PublicMethods,
  PublicSubscriptions,
  Subscriptions,
  OrderParams,
  PublicSubscriptionPrefix,
} from './types';
import { starts_with_prefix } from './helpers';
import { is_value_in_enum, generate_random_id } from '@igorpronin/utils';

export const custom_request = (client: WebSocket, method: string, id: string, params: any) => {
  const msg: any = {
    jsonrpc: '2.0',
    id,
    method,
    params,
  };
  client.send(JSON.stringify(msg));
  return msg;
};

export const request_subscribe = (client: WebSocket, subscription: Subscriptions): {msg: any, subscription: Subscriptions} => {
  let method: PublicMethods | PrivateMethods = PublicMethods.PublicSubscribe;
  if (is_value_in_enum(subscription, PrivateSubscriptions)) {
    method = PrivateMethods.PrivateSubscribe;
  }
  const msg = custom_request(client, method, `s/${subscription}`, {
    channels: [subscription],
  });
  return {msg, subscription};
};

export const requests_subscribe_to_portfolio = (client: WebSocket, currencies: Currencies[]) => {
  currencies.forEach((currency) => {
    request_subscribe(client, `user.portfolio.${currency}` as Subscriptions);
  });
};

// https://docs.deribit.com/#private-get_account_summary
// To read subaccount summary use subaccount_id parameter (not implemented yet)
export const request_get_account_summary = (client: WebSocket, currency: Currencies) => {
  let id: AccSummaryIDs;
  switch (currency) {
    case Currencies.BTC:
      id = AccSummaryIDs.AccountSummaryBtc;
      break;
    case Currencies.ETH:
      id = AccSummaryIDs.AccountSummaryEth;
      break;
    case Currencies.USDC:
      id = AccSummaryIDs.AccountSummaryUsdc;
      break;
    case Currencies.USDT:
      id = AccSummaryIDs.AccountSummaryUsdt;
      break;
    default:
      return;
  }
  const msg = custom_request(client, PrivateMethods.AccountSummary, id, {
    currency: currency,
    extended: true,
  });
  return msg;
};

// https://docs.deribit.com/#private-get_account_summaries
export const request_get_account_summaries = (client: WebSocket) => {
  const msg = custom_request(client, PrivateMethods.AccountSummaries, IDs.AccSummaries, {
    extended: true,
  });
  return msg;
};

// https://docs.deribit.com/#private-get_positions
export const request_get_positions = (client: WebSocket) => {
  const msg = custom_request(client, PrivateMethods.GetPositions, IDs.GetPositions, {
    currency: 'any',
  });
  return msg;
};

// https://docs.deribit.com/#private-get_order_state
export const request_get_order_state_by_id = (client: WebSocket, order_id: string) => {
  const msg = custom_request(client, PrivateMethods.GetOrderState, IDs.GetOrderState, {
    order_id,
  });
  return msg;
};

// https://docs.deribit.com/#private-buy
// https://docs.deribit.com/#private-sell
export const request_open_order = (
  client: WebSocket,
  { direction, amount, type, price, instrument_name, time_in_force }: OrderParams,
): {id: string, msg: any} => {
  const id = generate_random_id();
  const params = {
    instrument_name,
    amount,
    type,
    label: id,
    price,
    time_in_force,
  };
  const msg = custom_request(client, `private/${direction}`, `o/${id}`, params);
  return {id, msg};
};
