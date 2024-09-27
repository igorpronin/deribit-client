import WebSocket from 'ws';
import EventEmitter from 'events';
import { is_value_in_enum } from '@igorpronin/utils';
import {
  create_to_console,
  create_init_pending_subscriptions_check,
  create_count_refresh,
  create_handle_refresh_counter,
  create_validate_if_instance_is_ready,
} from './deribit_client_methods/utils';
import {
  create_handle_subscribed_message,
  create_handle_get_instruments_message,
  create_handle_get_currencies_message,
  create_handle_get_positions_message,
  create_handle_open_order_message,
} from './deribit_client_methods/message_handlers';
import {
  AccountSummary,
  Currencies,
  IDs,
  PrivateSubscriptions,
  RpcAuthMsg,
  RpcError,
  RpcMessage,
  RpcSubscribedMsg,
  Subscriptions,
  OrderParams,
  OrderData,
  RpcOpenOrderMsg,
  UserPortfolioByCurrency,
  Indexes,
  GetInstrumentIDs,
  RpcGetInstrumentsMsg,
  Instrument,
  Kinds,
  RpcGetCurrenciesMsg,
  CurrencyData,
  TickerData,
  RpcGetPositionsMsg,
  Position,
  RpcErrorResponse,
  RpcSuccessResponse,
  RpcSubscriptionMessage,
} from './types';
import {
  create_process_subscribe_on_requested_and_obligatory,
  create_process_get_positions,
  create_process_get_account_summaries_by_tickers,
  create_process_get_account_summaries,
  create_process_request_obligatory_data,
  create_process_open_order,
} from './deribit_client_methods/actions';
import {
  create_handle_rpc_error_response,
  create_handle_rpc_subscription_message,
  create_handle_rpc_success_response,
} from './deribit_client_methods/root_handlers';
import {
  create_auth,
  create_re_auth,
  create_handle_auth_message,
} from './deribit_client_methods/auth_requests_and_handlers';

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
  on_message: (message: RpcMessage) => void;
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
  // Predefined variables
  protected msg_prefix = '[Deribit client]';
  private subscriptions_check_time = 5; // Time in seconds after ws opened and authorized to check if pending subscriptions still exist
  // End of predefined variables

  // WebSocket client and Event Emitter
  public client: WebSocket;
  public ee: EventEmitter;
  // End of WebSocket client and Event Emitter

  // User defined variables and connection attributes
  private api_env: ApiEnv;
  private ws_api_url: string;
  private api_key: string; // API key
  private client_id: string; // API key ID
  private username: string | undefined;
  private acc_type: string | undefined;
  private user_id: number | undefined;
  protected output_console: boolean | undefined = true;
  private currencies: Currencies[];
  // End of user defined variables and connection attributes

  // Event handler functions
  private on_open: () => void;
  private on_close: () => void;
  private on_message: (message: string) => void;
  private on_error: (error: Error) => void;
  // End of Event handler functions

  // Refresh authorisation
  private count_refresh: () => any;
  private handle_refresh_counter: () => void;
  private refresh_interval = 550; // Refresh authorisation interval in seconds
  private refresh_counter: number = 0;
  private refresh_counter_id: any;
  // End of refresh authorisation

  // Auth, connection data, ready state
  private connection_opened_at: null | Date = null;
  private authorized_at: null | Date = null;
  private auth_data: AuthData = {
    state: false,
    refresh_token: null,
    access_token: null,
    expires_in: null,
    scope: {
      raw: null,
    },
  };
  /*
   * Instance is ready when all obligatory data is received
   * and all subscriptions are active (not pending or requested)
   *
   * All the arrays (requested_subscriptions, obligatory_subscriptions, pending_subscriptions,
   * obligatory_data) are used for the checks and should be empty when instance is ready
   *
   * Trade operations are not allowed when instance is not ready
   */
  private is_instance_ready: boolean = false;
  // End of Auth and connection data

  // Auth methods
  private auth: () => void;
  private re_auth: () => void;
  private handle_auth_message: (msg: RpcAuthMsg, is_re_auth: boolean) => void;
  // End of Auth methods

  // Utils
  private to_console: (msg: string, error?: RpcError) => void;
  private validate_if_instance_is_ready: () => void;
  private init_pending_subscriptions_check: () => void;
  // End of Utils

  // Root handlers
  private handle_rpc_error_response: (msg: RpcErrorResponse) => void;
  private handle_rpc_subscription_message: (msg: RpcSubscriptionMessage) => void;
  private handle_rpc_success_response: (msg: RpcSuccessResponse) => void;
  // End of Root handlers

  // Message handlers
  private handle_subscribed_message: (msg: RpcSubscribedMsg) => void;
  private handle_get_instruments_message: (msg: RpcGetInstrumentsMsg) => void;
  private handle_get_currencies_message: (msg: RpcGetCurrenciesMsg) => void;
  private handle_get_positions_message: (msg: RpcGetPositionsMsg) => void;
  private handle_open_order_message: (msg: RpcOpenOrderMsg) => void;
  // End of Message handlers

  // Actions
  private process_subscribe_on_requested_and_obligatory: () => void;
  private process_get_positions: () => void;
  private process_get_account_summaries_by_tickers: () => void;
  private process_get_account_summaries: () => void;
  private process_request_obligatory_data: () => void;
  public process_open_order: (params: OrderParams) => string;
  // End of Actions

  // Subscriptions and obligatory data
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
  // End of Subscriptions and obligatory data

  // Other
  private orders: Orders = {
    pending_orders_amount: 0,
    all: {},
    list: [],
    by_ref_id: {},
  };

  private portfolio: Partial<Record<Currencies, UserPortfolioByCurrency>> = {};

  private accounts_summary: Partial<Record<Currencies, AccountSummary>> = {};

  private positions: Record<string, Position> = {};

  private indexes: Partial<Record<Indexes, number | null>> = {};

  private deribit_instruments_list: Partial<Record<Kinds, Instrument[]>> = {};

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

    // Applying external functions (utils) to the class context
    this.to_console = create_to_console(this);
    this.count_refresh = create_count_refresh(this);
    this.handle_refresh_counter = create_handle_refresh_counter(this);
    this.validate_if_instance_is_ready = create_validate_if_instance_is_ready(this);
    this.init_pending_subscriptions_check = create_init_pending_subscriptions_check(this);
    // End of Utils

    // Applying root handlers
    this.handle_rpc_error_response = create_handle_rpc_error_response(this);
    this.handle_rpc_subscription_message = create_handle_rpc_subscription_message(this);
    this.handle_rpc_success_response = create_handle_rpc_success_response(this);
    // End of Applying root handlers

    // Applying auth methods
    this.auth = create_auth(this);
    this.re_auth = create_re_auth(this);
    this.handle_auth_message = create_handle_auth_message(this);
    // End of Applying auth methods

    // Applying message handlers
    this.handle_subscribed_message = create_handle_subscribed_message(this);
    this.handle_get_instruments_message = create_handle_get_instruments_message(this);
    this.handle_get_currencies_message = create_handle_get_currencies_message(this);
    this.handle_get_positions_message = create_handle_get_positions_message(this);
    this.handle_open_order_message = create_handle_open_order_message(this);
    // End of Applying message handlers

    // Applying actions
    this.process_subscribe_on_requested_and_obligatory =
      create_process_subscribe_on_requested_and_obligatory(this);
    this.process_get_positions = create_process_get_positions(this);
    this.process_get_account_summaries_by_tickers =
      create_process_get_account_summaries_by_tickers(this);
    this.process_get_account_summaries = create_process_get_account_summaries(this);
    this.process_request_obligatory_data = create_process_request_obligatory_data(this);
    this.process_open_order = create_process_open_order(this);
    // End of Applying actions

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
      const parsed: RpcMessage = JSON.parse(message);

      if ('error' in parsed) {
        this.handle_rpc_error_response(parsed as RpcErrorResponse);
        return;
      }

      if ('method' in parsed && parsed.method === 'subscription') {
        this.handle_rpc_subscription_message(parsed as RpcSubscriptionMessage);
        on_message(parsed as RpcMessage);
        return;
      }

      if ('result' in parsed) {
        this.handle_rpc_success_response(parsed as RpcSuccessResponse);
        on_message(parsed as RpcMessage);
        return;
      }
    };

    this.client.on('close', this.on_close);
    this.client.on('open', this.on_open);
    this.client.on('message', this.on_message);
    this.client.on('error', this.on_error);
  }

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

  public get_positions = () => this.positions;

  public get_position_by_instrument_name = (instrument_name: string) =>
    this.positions[instrument_name];
}
