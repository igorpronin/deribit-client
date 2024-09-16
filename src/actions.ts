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
} from './types';
import { is_value_in_enum, generate_random_id } from '@igorpronin/utils';

export const subscribe = (client: WebSocket, subscription: Subscriptions) => {
  const msg: any = {
    jsonrpc: '2.0',
    id: subscription,
    params: {
      channels: [subscription],
    },
  };
  if (is_value_in_enum(subscription, PublicSubscriptions)) {
    msg.method = PublicMethods.PublicSubscribe;
  }
  if (is_value_in_enum(subscription, PrivateSubscriptions)) {
    msg.method = PrivateMethods.PrivateSubscribe;
  }
  client.send(JSON.stringify(msg));
  return subscription;
};

// Warning: method doesn't work as expected (request accepts, but there is no any response)
// https://docs.deribit.com/#private-get_account_summary
// To read subaccount summary use subaccount_id parameter (not implemented yet)
export const get_account_summary = (client: WebSocket, currency: Currencies) => {
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
      return;
    case Currencies.ETH:
      msg.id = AccSummaryIDs.AccountSummaryEth;
      return;
    case Currencies.USDC:
      msg.id = AccSummaryIDs.AccountSummaryUsdc;
      return;
    case Currencies.USDT:
      msg.id = AccSummaryIDs.AccountSummaryUsdt;
      return;
  }
  client.send(JSON.stringify(msg));
};

export const get_order_state_by_id = (client: WebSocket, order_id: string) => {
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
export const open_order = (
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
