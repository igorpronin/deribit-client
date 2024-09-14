import WebSocket from 'ws';
import {clearInterval} from 'timers';
import EventEmitter from 'events';
import {
  is_value_in_enum,
  remove_elements_from_existing_array
} from '@igorpronin/utils';
import {
  AccountsSummary,
  AccSummaryIDs,
  AccountSummary,
  Currencies,
  IDs,
  PrivateSubscriptions,
  PublicMethods,
  PublicSubscriptions,
  RpcAuthMsg,
  RpcError,
  RpcMessages,
  RpcSubscribedMsg,
  Subscriptions,
  OrderParams,
  OrderData,
  OpenOrderMsg
} from './types';
import {
  get_account_summary,
  open_order,
  subscribe
} from './actions';

type AuthData = {
  state: boolean
  refresh_token: null | string
  access_token: null | string
  expires_in: null | number
  scope: {
    raw: null | string
  }
}

type Params = {
  ws_api_url: string
  api_key: string
  client_id: string
  on_open?: () => void
  on_close?: () => void
  on_error?: () => void
  on_message: (message: RpcMessages) => void
  subscriptions?: Subscriptions[]
}

type Orders = {
  pending_orders_amount: number
  all: {[id: string]: OrderData}
  list: OrderData[]
  by_ref_id: {[id: string]: OrderData}
}

export class DeribitClient {
  private msg_prefix = '[Deribit client]'
  private refresh_interval = 550 // Refresh authorisation interval in seconds
  private subscriptions_check_time = 5 // Time in seconds after ws opened and authorized to check if pending subscriptions still exist

  client: WebSocket;

  public ee: EventEmitter;

  private ws_api_url: string;
  private api_key: string;
  private client_id: string;
  private on_open: () => void;
  private on_close: () => void;
  private on_message: (message: string) => void
  private on_error: () => void

  private connection_opened_at: null | Date = null
  private authorized_at: null | Date = null

  private refresh_counter: number = 0;
  private refresh_counter_id: any

  private requested_subscriptions: Subscriptions[] = []
  private pending_subscriptions: Subscriptions[] = []
  private active_subscriptions: Subscriptions[] = []

  private orders: Orders = {
    pending_orders_amount: 0,
    all: {},
    list: [],
    by_ref_id: {}
  }

  private auth_data: AuthData = {
    state: false,
    refresh_token: null,
    access_token: null,
    expires_in: null,
    scope: {
      raw: null
    }
  }

  private accounts_summary: AccountsSummary = {
    BTC: null,
    ETH: null,
    USDC: null,
    USDT: null
  }

  private count_refresh = () => {
    return setInterval(() => {
      this.refresh_counter++;
      this.handle_refresh_counter();
    }, 1000);
  }

  private handle_refresh_counter = () => {
    if (this.refresh_counter === this.refresh_interval) {
      clearInterval(this.refresh_counter_id);
      this.refresh_counter = 0;
      this.re_auth();
    }
  }

  private to_console = (msg: string) => {
    console.log(`${this.msg_prefix} ${msg}`);
  }

  private auth = () => {
    this.to_console(`Initial Deribit authorisation for the client ${this.client_id} processing...`);
    const msg = {
      jsonrpc: '2.0',
      id: IDs.Auth,
      method: PublicMethods.Auth,
      params: {
        grant_type: 'client_credentials',
        client_id: this.client_id,
        client_secret: this.api_key
      }
    };
    this.client.send(JSON.stringify(msg));
  }

  private re_auth = () => {
    this.to_console(`Deribit re authorisation for the client ${this.client_id} processing...`);
    const msg = {
      jsonrpc: '2.0',
      id: IDs.ReAuth,
      method: PublicMethods.Auth,
      params: {
        grant_type: 'refresh_token',
        refresh_token: this.auth_data.refresh_token
      }
    };
    this.client.send(JSON.stringify(msg));
  }

  private handle_rpc_error = (msg: string, is_critical: boolean, error: RpcError) => {
    const {code, message} = error;
    const m = `${msg} (message: ${message}, code: ${code})`;
    this.to_console(m);
    if (is_critical) {
      throw new Error(m);
    }
  }

  private handle_auth_message = (msg: RpcAuthMsg, is_re_auth: boolean) => {
    let success_msg, err_msg;
    if (!is_re_auth) {
      success_msg = 'Authorized!';
      err_msg = 'Error during auth';
    } else {
      success_msg = 'Authorisation refreshed!';
      err_msg = 'Error during re-auth';
    }
    if (msg.error) {
      this.handle_rpc_error(err_msg, true, msg.error);
    }
    if (msg.result) {
      this.to_console(success_msg);
      this.auth_data.refresh_token = msg.result.refresh_token;
      this.auth_data.access_token = msg.result.access_token;
      this.auth_data.expires_in = msg.result.expires_in;
      this.auth_data.scope.raw = msg.result.scope;
      this.refresh_counter_id = this.count_refresh();
      if (!is_re_auth) {
        this.authorized_at = new Date();
        this.ee.emit('authorized');
      }
    }
  }

  private init_pending_subscriptions_check = () => {
    setTimeout(() => {
      if (this.pending_subscriptions.length) {
        let m = 'WARNING! Pending subscriptions still exist';
        this.pending_subscriptions.forEach(s => {
          m += `\n   ${s}`;
        })
        this.to_console(m);
      }
    }, this.subscriptions_check_time * 1000);
  }

  private handle_subscribed_message = (msg: RpcSubscribedMsg) => {
    if (msg.error) {
      this.handle_rpc_error('Subscription error', true, msg.error);
    }
    const {result} = msg;
    result.forEach(subscription => {
      remove_elements_from_existing_array(this.pending_subscriptions, subscription);
      this.active_subscriptions.push(subscription);
      this.ee.emit('subscribed', subscription);
      this.to_console(`Subscribed on ${subscription}`);
    })
  }

  private handle_open_order_message = (msg: OpenOrderMsg) => {
    const id = msg.id.split('/')[1];
    const order_data = this.orders.all[id];
    order_data.is_pending = false;
    this.orders.pending_orders_amount--;
    if (msg.error) {
      order_data.rpc_error_message = msg;
      this.handle_rpc_error('Subscription error', false, msg.error);
      return;
    }
    const order = msg.result.order;
    const {order_id, order_state} = order;
    order_data.order_rpc_message_results.push(order);
    if (!this.orders.by_ref_id[order_id]) {
      this.orders.by_ref_id[order_id] = order_data;
    }
    if (!order_data.state) {
      order_data.state = order_state;
    }
    const is_closing_states = order_state === 'filled' || order_state === 'rejected' || order_state === 'cancelled';
    if (order_data.state === 'open' && is_closing_states) {
      order_data.state = order_state;
    }
  }

  private subscribe_on_requested = () => {
    this.requested_subscriptions.forEach(subscription => {
      this.to_console(`Subscribing on ${subscription}...`)
      subscribe(this.client, subscription);
      this.pending_subscriptions.push(subscription);
    })
  }

  // Warning: method doesn't work as expected (request accepts, but there is no any response)
  private get_accounts_summary_from_deribit = () => {
    this.to_console(`Getting account summary for currency ${Currencies.BTC}...`);
    get_account_summary(this.client, Currencies.BTC);
    this.to_console(`Getting account summary for currency ${Currencies.ETH}...`);
    get_account_summary(this.client, Currencies.ETH);
    this.to_console(`Getting account summary for currency ${Currencies.USDC}...`);
    get_account_summary(this.client, Currencies.USDC);
    this.to_console(`Getting account summary for currency ${Currencies.USDT}...`);
    get_account_summary(this.client, Currencies.USDT);
  }

  public get_pending_subscriptions = () => this.pending_subscriptions;

  public get_active_subscriptions = () => this.active_subscriptions;

  public get_accounts_summary = () => this.accounts_summary;

  public has_pending_orders = (): boolean => this.orders.pending_orders_amount > 0;

  public open_order = (params: OrderParams) => {
    const id = open_order(this.client, params);
    this.orders.pending_orders_amount++;
    const order_data = {
      initial: params,
      is_pending: true,
      is_error: false,
      order_rpc_message_results: [],
      state: null
    }
    this.orders.all[id] = order_data;
    this.orders.list.push(order_data);
  }

  constructor(params: Params) {
    const {
      ws_api_url,
      api_key,
      client_id,
      on_open,
      on_close,
      on_message,
      on_error,
      subscriptions
    } = params;
    this.ws_api_url = ws_api_url;
    this.api_key = api_key;
    this.client_id = client_id;
    this.client = new WebSocket(ws_api_url);
    if (subscriptions) {
      this.requested_subscriptions = subscriptions;
    }

    this.ee = new EventEmitter();

    this.on_open = () => {
      this.connection_opened_at = new Date();
      this.auth();
      if (on_open) {
        on_open();
      }
    }
    this.on_close = () => {
      if (on_close) {
        on_close();
      }
    }
    this.on_error = () => {
      if (on_error) {
        on_error();
      }
    };
    this.on_message = (message) => {
      const parsed: RpcMessages = JSON.parse(message);

      if (parsed.id === IDs.Auth) {
        this.handle_auth_message(parsed as RpcAuthMsg, false);
        this.subscribe_on_requested();
        this.init_pending_subscriptions_check();
        // Warning: method doesn't work as expected (request accepts, but there is no any response)
        // this.get_accounts_summary_from_deribit();
        return;
      }

      if (parsed.id === IDs.ReAuth) {
        this.handle_auth_message(parsed as RpcAuthMsg, true);
        return;
      }

      if (
        is_value_in_enum(parsed.id, PublicSubscriptions) ||
        is_value_in_enum(parsed.id, PrivateSubscriptions)
      ) {
        this.handle_subscribed_message(parsed as RpcSubscribedMsg);
        if (this.pending_subscriptions.length === 0) {
          this.ee.emit('subscribed_all');
        }
        return;
      }

      if (parsed.id.startsWith('o/')) {
        this.handle_open_order_message(parsed as OpenOrderMsg);
        return;
      }

      // Warning: method doesn't work as expected (request accepts, but there is no any response)
      if (is_value_in_enum(parsed.id, AccSummaryIDs)) {
        const currency = parsed.id.split('/')[1] as Currencies;
        this.accounts_summary[currency] = parsed.result as AccountSummary;
        this.to_console(`Account summary for the currency ${currency} updated`);
        return;
      }

      on_message(parsed as RpcMessages);
    };

    this.client.on('close', this.on_close);
    this.client.on('open', this.on_open);
    this.client.on('message', this.on_message);
    this.client.on('error', this.on_error);
  }
}
