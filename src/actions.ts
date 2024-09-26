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

export const request_subscribe = (client: WebSocket, subscription: Subscriptions) => {
  const msg: any = {
    jsonrpc: '2.0',
    id: `s/${subscription}`,
    params: {
      channels: [subscription],
    },
  };

  if (starts_with_prefix(PublicSubscriptionPrefix, subscription)) {
    msg.method = PublicMethods.PublicSubscribe;
  }
  if (is_value_in_enum(subscription, PrivateSubscriptions)) {
    msg.method = PrivateMethods.PrivateSubscribe;
  }
  client.send(JSON.stringify(msg));
  return subscription;
};

export const requests_subscribe_to_portfolio = (client: WebSocket, currencies: Currencies[]) => {
  currencies.forEach((currency) => {
    request_subscribe(client, `user.portfolio.${currency}` as Subscriptions);
  });
};

// https://docs.deribit.com/#private-get_account_summary
// To read subaccount summary use subaccount_id parameter (not implemented yet)
export const request_get_account_summary = (client: WebSocket, currency: Currencies) => {
  const msg: any = {
    jsonrpc: '2.0',
    method: PrivateMethods.AccountSummary,
    params: {
      currency: currency,
      extended: true,
    },
  };
  switch (currency) {
    case Currencies.BTC:
      msg.id = AccSummaryIDs.AccountSummaryBtc;
      break;
    case Currencies.ETH:
      msg.id = AccSummaryIDs.AccountSummaryEth;
      break;
    case Currencies.USDC:
      msg.id = AccSummaryIDs.AccountSummaryUsdc;
      break;
    case Currencies.USDT:
      msg.id = AccSummaryIDs.AccountSummaryUsdt;
      break;
    default:
      return;
  }
  client.send(JSON.stringify(msg));
};

// https://docs.deribit.com/#private-get_account_summaries
export const request_get_account_summaries = (client: WebSocket) => {
  const msg: any = {
    jsonrpc: '2.0',
    id: IDs.AccSummaries,
    method: PrivateMethods.AccountSummaries,
    params: {
      extended: true,
    },
  };
  client.send(JSON.stringify(msg));
};

// https://docs.deribit.com/#private-get_positions
export const request_get_positions = (client: WebSocket) => {
  const msg: any = {
    jsonrpc: '2.0',
    id: IDs.GetPositions,
    method: PrivateMethods.GetPositions,
    params: { currency: 'any' },
  };
  client.send(JSON.stringify(msg));
};

// https://docs.deribit.com/#private-get_order_state
export const request_get_order_state_by_id = (client: WebSocket, order_id: string) => {
  const msg: any = {
    jsonrpc: '2.0',
    id: IDs.GetOrderState,
    method: PrivateMethods.GetOrderState,
    params: { order_id },
  };
  client.send(JSON.stringify(msg));
};

// https://docs.deribit.com/#private-buy
// https://docs.deribit.com/#private-sell
export const request_open_order = (
  client: WebSocket,
  { direction, amount, type, price, instrument_name, time_in_force }: OrderParams,
): string => {
  const id = generate_random_id();
  const params = {
    instrument_name,
    amount,
    type,
    label: id,
    price,
    time_in_force,
  };
  const msg = {
    jsonrpc: '2.0',
    id: `o/${id}`,
    method: `private/${direction}`,
    params,
  };
  client.send(JSON.stringify(msg));
  return id;
};
