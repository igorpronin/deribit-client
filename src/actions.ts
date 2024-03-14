import WebSocket from 'ws';
import {
  Subscriptions,
  PublicSubscriptions,
  PrivateSubscriptions,
  PublicMethods,
  PrivateMethods
} from './types';

export const is_value_in_enum = (value: Subscriptions, enum_type: any): boolean => {
  return Object.keys(enum_type).some(key => enum_type[key] === value);
}

export const subscribe = (client: WebSocket, subscription: Subscriptions) => {
  const msg: any = {
    jsonrpc: '2.0',
    id: subscription,
    params : {
      channels : [
        subscription
      ]
    }
  }
  if (is_value_in_enum(subscription, PublicSubscriptions)) {
    msg.method = PublicMethods.PublicSubscribe;
  }
  if (is_value_in_enum(subscription, PrivateSubscriptions)) {
    msg.method = PrivateMethods.PrivateSubscribe;
  }
  client.send(JSON.stringify(msg));
  return subscription;
}
