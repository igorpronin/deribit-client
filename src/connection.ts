import WebSocket from 'ws';
import { clearInterval } from 'timers';
import EventEmitter from 'events';
import { is_value_in_enum, remove_elements_from_existing_array } from '@igorpronin/utils';
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
  RpcOpenOrderMsg,
  RpcAccSummariesMsg,
  RpcSubscriptionMsg,
  Portfolio,
  UserPortfolioByCurrency,
} from './types';
import {
  get_account_summary,
  get_account_summaries,
  open_order,
  subscribe,
  subscribe_to_portfolio,
} from './actions';

type AuthData = {
  state: boolean;
  refresh_token: null | string;
  access_token: null | string;
  expires_in: null | number;
  scope: {
    raw: null | string;
  };
};

enum WssApiUrls {
  prod = 'wss://www.deribit.com/ws/api/v2',
  test = 'wss://test.deribit.com/ws/api/v2',
}

type ApiEnv = 'prod' | 'test';

type Params = {
  api_env: ApiEnv;
  api_key: string;
  currencies: Currencies[];
  client_id: string;
  instance_id?: string;
  on_open?: () => void;
  on_close?: () => void;
  on_error?: (error?: Error) => void;
  on_message: (message: RpcMessages) => void;
  subscriptions?: Subscriptions[];
};

type Orders = {
  pending_orders_amount: number;
  all: { [id: string]: OrderData };
  list: OrderData[];
  by_ref_id: { [id: string]: OrderData };
};

export class DeribitClient {
  private msg_prefix = '[Deribit client]';
  private refresh_interval = 550; // Refresh authorisation interval in seconds
  private subscriptions_check_time = 5; // Time in seconds after ws opened and authorized to check if pending subscriptions still exist

  client: WebSocket;

  public ee: EventEmitter;

  private api_env: ApiEnv;
  private ws_api_url: string;
  private api_key: string;
  private client_id: string;
  private username: string | undefined;
  private acc_type: string | undefined;
  private currencies: Currencies[];
  private on_open: () => void;
  private on_close: () => void;
  private on_message: (message: string) => void;
  private on_error: (error: Error) => void;

  private connection_opened_at: null | Date = null;
  private authorized_at: null | Date = null;

  private refresh_counter: number = 0;
  private refresh_counter_id: any;

  private requested_subscriptions: Subscriptions[] = [];
  private obligatory_subscriptions: Subscriptions[] = [PrivateSubscriptions.ChangesAnyAny];
  private pending_subscriptions: Subscriptions[] = [];
  private active_subscriptions: Subscriptions[] = [];

  private orders: Orders = {
    pending_orders_amount: 0,
    all: {},
    list: [],
    by_ref_id: {},
  };

  private auth_data: AuthData = {
    state: false,
    refresh_token: null,
    access_token: null,
    expires_in: null,
    scope: {
      raw: null,
    },
  };

  private accounts_summary: AccountsSummary = {
    BTC: null,
    ETH: null,
    USDC: null,
    USDT: null,
  };

  private portfolio: Portfolio = {
    BTC: null,
    ETH: null,
    USDC: null,
    USDT: null,
  };

  constructor(params: Params) {
    const {
      api_env,
      api_key,
      client_id,
      on_open,
      on_close,
      on_message,
      on_error,
      subscriptions,
      currencies,
    } = params;
    if (!api_env || !is_value_in_enum(api_env, ['prod', 'test'])) {
      throw new Error('Invalid API environment');
    }
    
    if (params.instance_id) {
      this.msg_prefix = `[Deribit client (${params.instance_id})]`;
    }
    this.api_env = api_env;
    this.ws_api_url = api_env === 'prod' ? WssApiUrls.prod : WssApiUrls.test;
    this.currencies = currencies;
    this.api_key = api_key;
    this.client_id = client_id;
    this.client = new WebSocket(this.ws_api_url);
    if (subscriptions) {
      this.requested_subscriptions = subscriptions;
    }

    this.currencies.forEach((currency) => {
      this.obligatory_subscriptions.push(`user.portfolio.${currency.toLowerCase()}` as Subscriptions);
    });

    this.ee = new EventEmitter();

    this.on_open = () => {
      this.connection_opened_at = new Date();
      this.auth();
      if (on_open) {
        on_open();
      }
    };
    this.on_close = () => {
      if (on_close) {
        on_close();
      }
    };
    this.on_error = (error) => {
      console.error(`${this.msg_prefix} WebSocket error`);
      console.error('WebSocket error:', error);
      if (on_error) {
        on_error(error);
      }
    };
    this.on_message = (message) => {
      const parsed: RpcMessages = JSON.parse(message);

      if (parsed.error) {
        this.to_console(`RPC error: ${parsed.error.message}`, parsed.error);
        return;
      }

      if ('method' in parsed && parsed.method === 'subscription') {
        this.handle_subscription_message(parsed as RpcSubscriptionMsg);
        return;
      }

      if (parsed.id === IDs.Auth) {
        this.handle_auth_message(parsed as RpcAuthMsg, false);
        this.subscribe_on_requested_and_obligatory();
        this.init_pending_subscriptions_check();
        this.get_account_summaries_by_tickers();
        this.get_account_summaries();
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

      if (parsed.id?.startsWith('o/')) {
        this.handle_open_order_message(parsed as RpcOpenOrderMsg);
        return;
      }

      if (is_value_in_enum(parsed.id, AccSummaryIDs)) {
        if ('result' in parsed) {
          const currency = parsed.id.split('/')[1] as Currencies;
          this.accounts_summary[currency] = parsed.result as AccountSummary;
          this.to_console(`Account summary for the currency ${currency} updated`);
        }
        return;
      }

      if (parsed.id === IDs.AccSummaries) {
        const data = parsed as RpcAccSummariesMsg;
        this.username = data.result.username;
        this.acc_type = data.result.type;
        this.to_console(`Account summaries got`);
      }

      on_message(parsed as RpcMessages);
    };

    this.client.on('close', this.on_close);
    this.client.on('open', this.on_open);
    this.client.on('message', this.on_message);
    this.client.on('error', this.on_error);
  }

  private to_console = (msg: string, error?: any) => {
    if (!error) {
      console.log(`${this.msg_prefix} ${msg}`);
    } else {
      console.error(`${this.msg_prefix} ${msg}`);
      console.error(error);
    }
  };

  private count_refresh = () => {
    return setInterval(() => {
      this.refresh_counter++;
      this.handle_refresh_counter();
    }, 1000);
  };

  private handle_refresh_counter = () => {
    if (this.refresh_counter === this.refresh_interval) {
      clearInterval(this.refresh_counter_id);
      this.refresh_counter = 0;
      this.re_auth();
    }
  };

  private auth = () => {
    this.to_console(`Initial Deribit authorisation for the client ${this.client_id} processing...`);
    const msg = {
      jsonrpc: '2.0',
      id: IDs.Auth,
      method: PublicMethods.Auth,
      params: {
        grant_type: 'client_credentials',
        client_id: this.client_id,
        client_secret: this.api_key,
      },
    };
    this.client.send(JSON.stringify(msg));
  };

  private re_auth = () => {
    this.to_console(`Deribit re authorisation for the client ${this.client_id} processing...`);
    const msg = {
      jsonrpc: '2.0',
      id: IDs.ReAuth,
      method: PublicMethods.Auth,
      params: {
        grant_type: 'refresh_token',
        refresh_token: this.auth_data.refresh_token,
      },
    };
    this.client.send(JSON.stringify(msg));
  };

  private handle_rpc_error = (msg: string, is_critical: boolean, error: RpcError) => {
    const { code, message } = error;
    const m = `${msg} (message: ${message}, code: ${code})`;
    this.to_console(m);
    if (is_critical) {
      throw new Error(m);
    }
  };

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
  };

  private init_pending_subscriptions_check = () => {
    setTimeout(() => {
      if (this.pending_subscriptions.length) {
        let m = 'WARNING! Pending subscriptions still exist';
        this.pending_subscriptions.forEach((s) => {
          m += `\n   ${s}`;
        });
        this.to_console(m);
      }
    }, this.subscriptions_check_time * 1000);
  };

  private handle_subscribed_message = (msg: RpcSubscribedMsg) => {
    if (msg.error) {
      this.handle_rpc_error('Subscription error', true, msg.error);
    }
    const { result } = msg;
    result.forEach((subscription) => {
      remove_elements_from_existing_array(this.pending_subscriptions, subscription);
      this.active_subscriptions.push(subscription);
      this.ee.emit('subscribed', subscription);
      this.to_console(`Subscribed on ${subscription}`);
    });
  };

  private handle_subscription_message = (msg: RpcSubscriptionMsg) => {
    const { channel, data } = msg.params;
    if (channel.startsWith('user.portfolio')) {
      const currency = channel.split('.')[2].toUpperCase() as Currencies;
      this.portfolio[currency] = data as UserPortfolioByCurrency;
      this.ee.emit('portfolio_updated', currency);
    }
  };

  private handle_open_order_message = (msg: RpcOpenOrderMsg) => {
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
    const { order_id, order_state } = order;
    order_data.order_rpc_message_results.push(order);
    if (!this.orders.by_ref_id[order_id]) {
      this.orders.by_ref_id[order_id] = order_data;
    }
    if (!order_data.state) {
      order_data.state = order_state;
    }
    const is_closing_states =
      order_state === 'filled' || order_state === 'rejected' || order_state === 'cancelled';
    if (order_data.state === 'open' && is_closing_states) {
      order_data.state = order_state;
    }
  };

  private subscribe_on_requested_and_obligatory = () => {
    this.requested_subscriptions.forEach((subscription) => {
      this.to_console(`Subscribing on ${subscription}...`);
      subscribe(this.client, subscription);
      this.pending_subscriptions.push(subscription);
    });
    this.obligatory_subscriptions.forEach((subscription) => {
      this.to_console(`Subscribing on ${subscription}...`);
      subscribe(this.client, subscription);
      this.pending_subscriptions.push(subscription);
    });
  };

  private get_account_summaries_by_tickers = () => {
    this.currencies.forEach((currency) => {
      this.to_console(`Getting account summary for currency ${currency}...`);
      get_account_summary(this.client, currency);
    });
  };

  private get_account_summaries = () => {
    this.to_console(`Getting account summaries...`);
    get_account_summaries(this.client);
  };

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
      state: null,
    };
    this.orders.all[id] = order_data;
    this.orders.list.push(order_data);
  };
}
