import WebSocket from 'ws';
import EventEmitter from 'events';
import { is_value_in_enum } from '@igorpronin/utils';
import {
  Currencies,
  RpcMessage,
  Subscriptions,
  OrderParams,
  OrderData,
  Kinds,
  RpcErrorResponse,
  RpcSuccessResponse,
  RpcSubscriptionMessage,
} from './types/types';
import {
  AccountSummary,
  Indexes,
  Instrument,
  CurrencyData,
  TickerData,
  Position,
} from './types/deribit_objects';
import {
  handle_rpc_error_response,
  handle_rpc_subscription_message,
  handle_rpc_success_response,
} from './deribit_client_methods/root_handlers';
import { create_process_open_order } from './deribit_client_methods/actions';
import { auth } from './deribit_client_methods/auth_requests_and_handlers';

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
  client_id: string;
  instance_id?: string;
  output_console?: boolean;
  indexes_to_monitor_or_trade?: Indexes[];
  instruments_to_monitor_or_trade?: string[];
  on_open?: () => void;
  on_close?: () => void;
  on_error?: (error?: Error) => void;
  on_message: (message: RpcMessage) => void;
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
  public msg_prefix = '[Deribit client]';
  public subscriptions_check_time = 5; // Time in seconds after ws opened and authorized to check if pending subscriptions still exist
  // End of predefined variables

  // WebSocket client and Event Emitter
  public client: WebSocket;
  public ee: EventEmitter;
  // End of WebSocket client and Event Emitter

  // User defined variables and connection attributes
  public api_env: ApiEnv;
  public ws_api_url: string;
  public api_key: string; // API key
  public client_id: string; // API key ID
  public username: string | undefined;
  public acc_type: string | undefined;
  public user_id: number | undefined;
  public output_console: boolean | undefined = true;
  // End of user defined variables and connection attributes

  // Event handler functions
  private on_open: () => void;
  private on_close: () => void;
  private on_message: (message: string) => void;
  private on_error: (error: Error) => void;
  // End of Event handler functions

  // Refresh authorisation
  public refresh_interval = 550; // Refresh authorisation interval in seconds
  public refresh_counter: number = 0;
  public refresh_counter_id: any;
  // End of refresh authorisation

  // Auth, connection data, ready state
  public connection_opened_at: null | Date = null;
  public authorized_at: null | Date = null;
  public auth_data: AuthData = {
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
  public is_instance_ready: boolean = false;
  // End of Auth and connection data

  // Utils
  // public to_console: (msg: string, error?: RpcError) => void;
  // public validate_if_instance_is_ready: () => void;
  // public init_pending_subscriptions_check: () => void;
  // End of Utils

  // Actions
  public process_open_order: (params: OrderParams) => string;
  // End of Actions

  // Subscriptions and obligatory data
  public pending_subscriptions: Subscriptions[] = [];
  public active_subscriptions: Subscriptions[] = [];
  public obligatory_data_pending: string[] = [];
  public obligatory_data_received: string[] = [];
  // End of Subscriptions and obligatory data

  // Other
  public orders: Orders = {
    pending_orders_amount: 0,
    all: {},
    list: [],
    by_ref_id: {},
  };

  public account_summaries: Partial<Record<Currencies, AccountSummary>> = {};

  public positions: Record<string, Position> = {};

  public indexes: Partial<Record<Indexes, number | null>> = {};

  public deribit_instruments_list: Partial<Record<Kinds, Instrument[]>> = {};

  public deribit_instruments_by_name: Record<string, Instrument> = {};

  public ticker_data: Record<string, TickerFullData> = {};

  public deribit_currencies_list: CurrenciesData = { list: [] };

  constructor(params: Params) {
    const { api_env, api_key, client_id, output_console, on_open, on_close, on_message, on_error } =
      params;

    if (!api_env || !is_value_in_enum(api_env, ['prod', 'test'])) {
      throw new Error('Invalid API environment');
    }

    // Applying external functions (utils) to the class context
    // this.to_console = create_to_console(this);
    // this.count_refresh = create_count_refresh(this);
    // this.handle_refresh_counter = create_handle_refresh_counter(this);
    // this.validate_if_instance_is_ready = create_validate_if_instance_is_ready(this);
    // this.init_pending_subscriptions_check = create_init_pending_subscriptions_check(this);
    // End of Utils

    // Applying auth methods
    // this.auth = create_auth(this);
    // this.re_auth = create_re_auth(this);
    // this.handle_auth_message = create_handle_auth_message(this);
    // End of Applying auth methods

    // Applying message handlers
    // this.handle_subscribed_message = create_handle_subscribed_message(this);
    // this.handle_get_instruments_message = create_handle_get_instruments_message(this);
    // this.handle_get_currencies_message = create_handle_get_currencies_message(this);
    // this.handle_get_positions_message = create_handle_get_positions_message(this);
    // this.handle_open_order_message = create_handle_open_order_message(this);
    // End of Applying message handlers

    // Applying public actions
    this.process_open_order = create_process_open_order(this);
    // End of Applying public actions

    if (params.instance_id) {
      this.msg_prefix = `[Deribit client (${params.instance_id})]`;
    }
    this.api_env = api_env;
    this.ws_api_url = api_env === 'prod' ? WssApiUrls.prod : WssApiUrls.test;
    this.output_console = output_console;
    this.api_key = api_key;
    this.client_id = client_id;
    this.client = new WebSocket(this.ws_api_url);

    this.ee = new EventEmitter();

    this.on_open = () => {
      this.connection_opened_at = new Date();
      auth(this);
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
        handle_rpc_error_response(this, parsed as RpcErrorResponse);
        return;
      }

      if ('method' in parsed && parsed.method === 'subscription') {
        handle_rpc_subscription_message(this, parsed as RpcSubscriptionMessage);
        on_message(parsed as RpcMessage);
        return;
      }

      if ('result' in parsed) {
        handle_rpc_success_response(this, parsed as RpcSuccessResponse);
        on_message(parsed as RpcMessage);
        return;
      }
    };

    this.client.on('close', this.on_close);
    this.client.on('open', this.on_open);
    this.client.on('message', this.on_message);
    this.client.on('error', this.on_error);
  }

  // Getters
  public get_configuration = () => {
    return {
      api_env: this.api_env,
      ws_api_url: this.ws_api_url,
      client_id: this.client_id,
      username: this.username,
      acc_type: this.acc_type,
      user_id: this.user_id,
      is_instance_ready: this.is_instance_ready,
    };
  };

  public get_index = (index: Indexes) => this.indexes[index];

  public get_pending_subscriptions = () => this.pending_subscriptions;

  public get_active_subscriptions = () => this.active_subscriptions;

  public get_account_summaries = () => this.account_summaries;

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

  public has_pending_orders = (): boolean => this.orders.pending_orders_amount > 0;
}
