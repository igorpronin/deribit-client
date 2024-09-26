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
  Indexes,
  BTCIndexData,
  GetInstrumentIDs,
  RpcGetInstrumentsMsg,
  Instrument,
  Kinds,
  RpcGetCurrenciesMsg,
  CurrencyData,
  TickerData,
  RpcGetPositionsMsg,
  Position,
} from './types';
import {
  request_get_account_summary,
  request_get_account_summaries,
  request_get_positions,
  request_open_order,
  request_subscribe,
  custom_request,
} from './actions';
import { calculate_future_apr_and_premium } from './helpers';

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
  output_console?: boolean;
};

type TickerFullData = {
  raw: TickerData;
  calculated: {
    time_to_expiration_in_minutes: number | null;
    apr: number | null;
    premium_absolute: number | null;
    premium_relative: number | null;
  };
};

type CurrenciesData = { list: CurrencyData[] };

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

  // Instance is ready when all obligatory data is received
  // and all subscriptions are active (not pending or requested)
  //
  // All the arrays (requested_subscriptions, obligatory_subscriptions, pending_subscriptions,
  //obligatory_data) are used for the checks and should be empty when instance is ready
  //
  // Change operations are not allowed when instance is not ready
  private is_instance_ready: boolean = false;

  private api_env: ApiEnv;
  private ws_api_url: string;
  private api_key: string; // API key
  private client_id: string; // API key ID
  private output_console: boolean | undefined = true;
  private username: string | undefined;
  private acc_type: string | undefined;
  private user_id: number | undefined;
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

  private obligatory_data = [
    GetInstrumentIDs.GetInstrumentFuture,
    GetInstrumentIDs.GetInstrumentOptions,
    GetInstrumentIDs.GetInstrumentSpot,
    IDs.GetCurrencies,
    IDs.GetPositions,
  ];
  private obligatory_data_pending: string[] = [];
  private obligatory_data_received: string[] = [];

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

  private positions: Record<string, Position> = {};

  private indexes: { [key in Indexes]: number | null } = {
    btc_usd: null,
    eth_usd: null,
  };

  private deribit_instruments_list: {
    [key in Kinds]: Instrument[];
  } = {
    spot: [],
    future: [],
    option: [],
    future_combo: [],
    option_combo: [],
  };

  private deribit_instruments_by_name: Record<string, Instrument> = {};

  private ticker_data: Record<string, TickerFullData> = {};

  private deribit_currencies_list: CurrenciesData = { list: [] };

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
      output_console,
    } = params;
    if (!api_env || !is_value_in_enum(api_env, ['prod', 'test'])) {
      throw new Error('Invalid API environment');
    }

    if (params.instance_id) {
      this.msg_prefix = `[Deribit client (${params.instance_id})]`;
    }
    this.api_env = api_env;
    this.ws_api_url = api_env === 'prod' ? WssApiUrls.prod : WssApiUrls.test;
    this.output_console = output_console;
    this.currencies = currencies;
    this.api_key = api_key;
    this.client_id = client_id;
    this.client = new WebSocket(this.ws_api_url);
    if (subscriptions) {
      this.requested_subscriptions = subscriptions;
    }

    this.currencies.forEach((currency) => {
      this.obligatory_subscriptions.push(
        `user.portfolio.${currency.toLowerCase()}` as Subscriptions,
      );
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
        on_message(parsed as RpcMessages);
        return;
      }

      if (parsed.id === IDs.Auth) {
        this.handle_auth_message(parsed as RpcAuthMsg, false);
        this.process_request_obligatory_data();
        this.process_subscribe_on_requested_and_obligatory();
        this.process_get_account_summaries_by_tickers();
        this.process_get_account_summaries();
        this.init_pending_subscriptions_check();
        on_message(parsed as RpcMessages);
        return;
      }

      if (parsed.id === IDs.ReAuth) {
        this.handle_auth_message(parsed as RpcAuthMsg, true);
        on_message(parsed as RpcMessages);
        return;
      }

      if (parsed.id.startsWith('s/')) {
        this.handle_subscribed_message(parsed as RpcSubscribedMsg);
        if (this.pending_subscriptions.length === 0) {
          this.ee.emit('subscribed_all');
        }
        this.validate_if_instance_is_ready();
        on_message(parsed as RpcMessages);
        return;
      }

      if (parsed.id?.startsWith('o/')) {
        this.handle_open_order_message(parsed as RpcOpenOrderMsg);
        on_message(parsed as RpcMessages);
        return;
      }

      if (is_value_in_enum(parsed.id, AccSummaryIDs)) {
        if ('result' in parsed) {
          const currency = parsed.id.split('/')[1] as Currencies;
          this.accounts_summary[currency] = parsed.result as AccountSummary;
          this.to_console(`Account summary for the currency ${currency} updated`);
        }
        on_message(parsed as RpcMessages);
        return;
      }

      if (parsed.id === IDs.AccSummaries) {
        const data = parsed as RpcAccSummariesMsg;
        this.username = data.result.username;
        this.acc_type = data.result.type;
        this.user_id = data.result.id;
        this.to_console(`Account summaries got`);
        on_message(parsed as RpcMessages);
        return;
      }

      if (parsed.id === IDs.GetCurrencies) {
        if ('result' in parsed) {
          remove_elements_from_existing_array(this.obligatory_data_pending, parsed.id);
          this.obligatory_data_received.push(parsed.id);
        }
        this.handle_get_currencies_message(parsed as unknown as RpcGetCurrenciesMsg);
        this.validate_if_instance_is_ready();
        on_message(parsed as RpcMessages);
        return;
      }

      if (parsed.id === IDs.GetPositions) {
        if ('result' in parsed) {
          remove_elements_from_existing_array(this.obligatory_data_pending, parsed.id);
          this.obligatory_data_received.push(parsed.id);
        }
        this.handle_get_positions_message(parsed as unknown as RpcGetPositionsMsg);
        this.validate_if_instance_is_ready();
        on_message(parsed as RpcMessages);
        return;
      }

      if (parsed.id.startsWith('get_instruments/')) {
        if ('result' in parsed) {
          remove_elements_from_existing_array(this.obligatory_data_pending, parsed.id);
          this.obligatory_data_received.push(parsed.id);
        }
        this.handle_get_instruments_message(parsed as unknown as RpcGetInstrumentsMsg);
        this.validate_if_instance_is_ready();
        on_message(parsed as RpcMessages);
        return;
      }
    };

    this.client.on('close', this.on_close);
    this.client.on('open', this.on_open);
    this.client.on('message', this.on_message);
    this.client.on('error', this.on_error);
  }

  private to_console = (msg: string, error?: any) => {
    if (error) {
      console.error(`${this.msg_prefix} ${msg}`);
      console.error(error);
    }
    if (!this.output_console) {
      return;
    }
    if (!error) {
      console.log(`${this.msg_prefix} ${msg}`);
    }
  };

  private validate_if_instance_is_ready = () => {
    const previous_state = this.is_instance_ready;
    this.is_instance_ready =
      this.pending_subscriptions.length === 0 && this.obligatory_data_pending.length === 0;
    const new_state = this.is_instance_ready;
    if (previous_state !== new_state && new_state) {
      this.ee.emit('instance_ready');
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
      this.auth_data.state = false;
      this.handle_rpc_error(err_msg, true, msg.error);
    }
    if (msg.result) {
      this.auth_data.refresh_token = msg.result.refresh_token;
      this.auth_data.access_token = msg.result.access_token;
      this.auth_data.expires_in = msg.result.expires_in;
      this.auth_data.scope.raw = msg.result.scope;
      this.refresh_counter_id = this.count_refresh();
      if (!is_re_auth) {
        this.authorized_at = new Date();
        this.ee.emit('authorized');
      }
      this.auth_data.state = true;
      this.to_console(success_msg);
    }
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
      return;
    }
    if (channel.startsWith('deribit_price_index')) {
      const pair = channel.split('.')[1] as Indexes;
      const { price } = data as BTCIndexData;
      this.indexes[pair] = price;
      this.ee.emit('index_updated', pair);
      return;
    }
    if (channel.startsWith('ticker')) {
      const instrument_name = channel.split('.')[1];
      if (!this.ticker_data[instrument_name]) {
        this.ticker_data[instrument_name] = {
          raw: data as TickerData,
          calculated: {
            time_to_expiration_in_minutes: null,
            apr: null,
            premium_absolute: null,
            premium_relative: null,
          },
        };
      }
      this.ticker_data[instrument_name].raw = data as TickerData;
      this.ticker_data[instrument_name].calculated = calculate_future_apr_and_premium({
        index_price: this.ticker_data[instrument_name].raw.index_price,
        mark_price: this.ticker_data[instrument_name].raw.mark_price,
        timestamp: this.ticker_data[instrument_name].raw.timestamp,
        expiration_timestamp:
          this.deribit_instruments_by_name[instrument_name].expiration_timestamp,
      });
      this.ee.emit('ticker_updated', instrument_name);
      return;
    }
    if (channel.startsWith('user.changes')) {
      const parts = channel.split('.');
      // console.log(parts);
      // console.log(data);
      // this.portfolio[currency] = data as UserPortfolioByCurrency;
      // this.ee.emit('portfolio_updated', currency);
      return;
    }
  };

  private handle_get_instruments_message = (msg: RpcGetInstrumentsMsg) => {
    const kind = msg.id.split('/')[1] as Kinds;
    const { result } = msg;
    const list = result as Instrument[];
    this.deribit_instruments_list[kind as keyof typeof this.deribit_instruments_list] = list;
    list.forEach((instrument) => {
      this.deribit_instruments_by_name[instrument.instrument_name] = instrument;
    });
  };

  private handle_get_currencies_message = (msg: RpcGetCurrenciesMsg) => {
    const { result } = msg;
    const list = result as CurrencyData[];
    this.deribit_currencies_list.list = list;
  };

  private handle_get_positions_message = (msg: RpcGetPositionsMsg) => {
    const { result } = msg;
    result.forEach((position) => {
      this.positions[position.instrument_name] = position;
      this.ee.emit('position_updated', position.instrument_name);
    });
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

  private process_subscribe_on_requested_and_obligatory = () => {
    if (!this.auth_data.state) {
      throw new Error('Not authorized');
    }
    this.requested_subscriptions.forEach((subscription) => {
      this.to_console(`Subscribing on ${subscription}...`);
      request_subscribe(this.client, subscription);
      this.pending_subscriptions.push(subscription);
    });
    this.obligatory_subscriptions.forEach((subscription) => {
      this.to_console(`Subscribing on ${subscription}...`);
      request_subscribe(this.client, subscription);
      this.pending_subscriptions.push(subscription);
    });
  };

  private process_get_positions = () => {
    if (!this.auth_data.state) {
      throw new Error('Not authorized');
    }
    this.to_console(`Requesting positions...`);
    request_get_positions(this.client);
  };

  private process_get_account_summaries_by_tickers = () => {
    if (!this.auth_data.state) {
      throw new Error('Not authorized');
    }
    this.currencies.forEach((currency) => {
      this.to_console(`Getting account summary for currency ${currency}...`);
      request_get_account_summary(this.client, currency);
    });
  };

  private process_get_account_summaries = () => {
    if (!this.auth_data.state) {
      throw new Error('Not authorized');
    }
    this.to_console(`Getting account summaries...`);
    request_get_account_summaries(this.client);
  };

  private process_request_obligatory_data = () => {
    this.to_console(`Requesting obligatory data...`);

    this.to_console(`Requesting future instruments...`);
    this.obligatory_data_pending.push(GetInstrumentIDs.GetInstrumentFuture);
    custom_request(this.client, 'public/get_instruments', GetInstrumentIDs.GetInstrumentFuture, {
      currency: 'any',
      kind: 'future',
    });

    this.to_console(`Requesting options instruments...`);
    this.obligatory_data_pending.push(GetInstrumentIDs.GetInstrumentOptions);
    custom_request(this.client, 'public/get_instruments', GetInstrumentIDs.GetInstrumentOptions, {
      currency: 'any',
      kind: 'option',
    });

    this.to_console(`Requesting spot instruments...`);
    this.obligatory_data_pending.push(GetInstrumentIDs.GetInstrumentSpot);
    custom_request(this.client, 'public/get_instruments', GetInstrumentIDs.GetInstrumentSpot, {
      currency: 'any',
      kind: 'spot',
    });

    this.to_console(`Requesting currencies...`);
    this.obligatory_data_pending.push(IDs.GetCurrencies);
    custom_request(this.client, 'public/get_currencies', IDs.GetCurrencies, {});

    this.obligatory_data_pending.push(IDs.GetPositions);
    this.process_get_positions();
  };

  public get_configuration = () => {
    return {
      api_env: this.api_env,
      ws_api_url: this.ws_api_url,
      client_id: this.client_id,
      currencies: this.currencies,
      username: this.username,
      acc_type: this.acc_type,
      user_id: this.user_id,
      is_instance_ready: this.is_instance_ready,
    };
  };

  public get_index = (index: Indexes) => this.indexes[index];

  public get_pending_subscriptions = () => this.pending_subscriptions;

  public get_active_subscriptions = () => this.active_subscriptions;

  public get_accounts_summary = () => this.accounts_summary;

  public get_obligatory_data_state = () => this.obligatory_data;

  public get_portfolio_by_currency = (currency: Currencies) => this.portfolio[currency];

  public has_pending_orders = (): boolean => this.orders.pending_orders_amount > 0;

  public get_deribit_instruments = (kind: Kinds) => this.deribit_instruments_list[kind];

  public get_deribit_instrument_by_name = (instrument_name: string) =>
    this.deribit_instruments_by_name[instrument_name];

  public get_deribit_currencies_list = () => this.deribit_currencies_list.list;

  public get_raw_ticker_data = (instrument_name: string) => this.ticker_data[instrument_name]?.raw;

  public get_calculated_ticker_data = (instrument_name: string) =>
    this.ticker_data[instrument_name]?.calculated;

  public open_order = (params: OrderParams) => {
    if (!this.auth_data.state) {
      throw new Error('Not authorized');
    }
    if (!this.is_instance_ready) {
      throw new Error('Instance is not ready');
    }
    const id = request_open_order(this.client, params);
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

  public get_positions = () => this.positions;

  public get_position_by_instrument_name = (instrument_name: string) => this.positions[instrument_name];
}
