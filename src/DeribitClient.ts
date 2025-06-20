import WebSocket from 'ws';
import EventEmitter from 'events';
import {
  Currencies,
  RpcMessage,
  OrderParams,
  OrderData,
  Kinds,
  SpotInstrument,
  RpcErrorResponse,
  RpcSuccessResponse,
  RpcSubscriptionMessage,
  ScopeTitle,
  Scope,
  UserPortfolioByCurrency,
  UserChanges,
  EditOrderPriceParams,
  ApiEnv,
} from './types/types';
import {
  AccountSummary,
  Indexes,
  Instrument,
  CurrencyData,
  TickerData,
  Position,
  Trade,
  TransactionLogItem,
  TransactionLogCurrencies,
} from './types/deribit_objects';
import {
  handle_rpc_error_response,
  handle_rpc_subscription_message,
  handle_rpc_success_response,
} from './deribit_client_methods/root_handlers';
import {
  create_process_edit_order_price,
  create_process_open_order,
  create_process_cancel_order,
} from './deribit_client_methods/actions';
import { auth } from './deribit_client_methods/auth_requests_and_handlers';
import { validate_user_requests, to_console } from './deribit_client_methods/utils';
import moment from 'moment';
import { validate_api_env } from './helpers';

type AuthData = {
  state: boolean;
  refresh_token: null | string;
  access_token: null | string;
  expires_in: null | number;
  trade_permit: boolean;
  scope: {
    processed: Partial<Record<ScopeTitle, Scope>>;
    raw: null | string;
  };
};

enum WssApiUrls {
  prod = 'wss://www.deribit.com/ws/api/v2',
  test = 'wss://test.deribit.com/ws/api/v2',
}

type Params = {
  api_env: ApiEnv;
  api_key: string;
  client_id: string;
  readonly?: boolean;
  reconnect?: boolean;
  instance_id?: string;
  output_console?: boolean;
  silent_reauth?: boolean;
  fetch_transactions_log_from?: string;
  track_transactions_log?: boolean;
  indexes?: Indexes[];
  instruments?: string[];
  instruments_with_orderbook?: boolean;

  // TODO: implement orderbook_depth_price correct and clear processing, include to README.md
  orderbook_depth_price?: number;

  on_open?: () => void;
  on_close?: () => void;
  on_error?: (error?: Error) => void;
  on_message: (message: RpcMessage) => void;
};

type TickerFullData = {
  raw: TickerData;
  calculated: {
    time_to_expiration_in_minutes?: number | null;
    apr?: number | null;
    premium_absolute: number | null;
    premium_relative: number | null;
  };
};

type BookData = {
  instrument_name: string;
  is_snapshot_received: boolean;
  bids_amount: number;
  asks_amount: number;
  bids: [price: number, amount: number][];
  asks: [price: number, amount: number][];
  mid_price: number | null;
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
  // @ts-ignore
  public client: WebSocket;
  public ee: EventEmitter;
  // End of WebSocket client and Event Emitter

  // User defined variables and connection attributes
  public api_env: ApiEnv;
  public ws_api_url: string;
  public api_key: string; // API key
  public client_id: string; // API key ID
  public readonly: boolean;
  public reconnect: boolean;
  public username: string | undefined;
  public acc_type: string | undefined;
  public user_id: number | undefined;
  public output_console: boolean | undefined;
  public silent_reauth: boolean | undefined;
  public indexes: Indexes[] | undefined;
  public instruments: string[] | undefined;
  public instruments_with_orderbook: boolean;
  public orderbook_depth_price: number | undefined;
  public fetch_transactions_log_from: number | undefined;
  public track_transactions_log: boolean | undefined;
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
    trade_permit: false,
    scope: {
      processed: {},
      raw: null,
    },
  };
  // End of Auth and connection data

  // Actions
  public process_open_order: (params: OrderParams) => string;
  public process_edit_order_price: (params: EditOrderPriceParams) => string;
  public process_cancel_order: (id: string) => string;
  // End of Actions

  // Subscriptions and obligatory data
  public subscriptions_pending: string[] = [];
  public subscriptions_active: string[] = [];
  public obligatory_data_pending: string[] = [];
  public obligatory_data_received: string[] = [];
  public is_obligatory_data_received: boolean = false;
  // End of Subscriptions and obligatory data

  // Other
  public orders: Orders = {
    pending_orders_amount: 0,
    all: {},
    list: [],
    by_ref_id: {},
  };

  public currencies_in_work: Currencies[] = [];

  public trades: Trade[] = [];
  public trades_by_id: Record<string, Trade> = {};

  public transactions_log: Partial<
    Record<
      TransactionLogCurrencies,
      {
        by_id: Record<number, TransactionLogItem>;
        list: TransactionLogItem[];
      }
    >
  > = {};

  public user_changes: UserChanges[] = [];

  public account_summaries: Partial<Record<Currencies, AccountSummary | UserPortfolioByCurrency>> =
    {};

  public positions: Record<string, Position> = {};

  public indexes_list: Partial<Record<Indexes, number | null>> = {};

  public deribit_instruments_list: Partial<Record<Kinds, Instrument[]>> = {};

  public deribit_instruments_by_name: Record<string, Instrument | SpotInstrument> = {
    BTC_USDC: { kind: 'spot' }, // Added manually, cause endpoint https://docs.deribit.com/#public-get_instrument doesn't return spot instruments
    BTC_USDT: { kind: 'spot' }, // Added manually, cause endpoint https://docs.deribit.com/#public-get_instrument doesn't return spot instruments
    ETH_USDC: { kind: 'spot' }, // Added manually, cause endpoint https://docs.deribit.com/#public-get_instrument doesn't return spot instruments
    ETH_USDT: { kind: 'spot' }, // Added manually, cause endpoint https://docs.deribit.com/#public-get_instrument doesn't return spot instruments
  };

  public ticker_data: Record<string, TickerFullData> = {};

  public book_data: Record<string, BookData> = {};

  public deribit_currencies_list: CurrenciesData = { list: [] };

  private connect = () => {
    this.client = new WebSocket(this.ws_api_url);
    this.client.on('close', this.on_close);
    this.client.on('open', this.on_open);
    this.client.on('message', this.on_message);
    this.client.on('error', this.on_error);
  };

  constructor(params: Params) {
    const {
      api_env,
      api_key,
      client_id,
      output_console,
      silent_reauth,
      readonly,
      reconnect,
      indexes,
      instruments,
      instruments_with_orderbook,
      orderbook_depth_price,
      fetch_transactions_log_from,
      track_transactions_log,
      on_open,
      on_close,
      on_message,
      on_error,
    } = params;

    validate_api_env(api_env);

    // Applying public actions
    this.process_open_order = create_process_open_order(this);
    this.process_edit_order_price = create_process_edit_order_price(this);
    this.process_cancel_order = create_process_cancel_order(this);
    // End of Applying public actions

    if (params.instance_id) {
      this.msg_prefix = this.msg_prefix += ` [${params.instance_id}]`;
    }
    this.api_env = api_env;
    this.ws_api_url = api_env === 'prod' ? WssApiUrls.prod : WssApiUrls.test;
    this.output_console = output_console !== undefined ? output_console : true;
    this.silent_reauth = silent_reauth !== undefined ? silent_reauth : true;
    this.readonly = readonly !== undefined ? readonly : false;
    this.reconnect = reconnect !== undefined ? reconnect : true;
    this.api_key = api_key;
    this.client_id = client_id;
    this.indexes = indexes;
    this.instruments = instruments;
    this.instruments_with_orderbook =
      instruments_with_orderbook !== undefined ? instruments_with_orderbook : false;
    this.orderbook_depth_price = orderbook_depth_price;
    this.track_transactions_log =
      track_transactions_log !== undefined ? track_transactions_log : false;
    this.fetch_transactions_log_from = fetch_transactions_log_from
      ? (() => {
          const parsedDate = moment(fetch_transactions_log_from);
          if (!parsedDate.isValid()) {
            throw new Error(
              `Invalid date format for fetch_transactions_log_from: ${fetch_transactions_log_from}`,
            );
          }
          return parsedDate.unix() * 1000;
        })()
      : undefined;
    validate_user_requests(this);

    this.instruments?.forEach((instrument) => {
      const currency = instrument.split('-')[0] as Currencies;
      if (!this.currencies_in_work.includes(currency)) {
        this.currencies_in_work.push(currency);
      }
    });

    this.ee = new EventEmitter();

    this.on_open = () => {
      this.connection_opened_at = new Date();
      auth(this);
      if (on_open) {
        on_open();
      }
    };
    this.on_close = () => {
      this.ee.emit('disconnected');
      to_console(this, 'Connection closed');
      if (this.reconnect) {
        to_console(this, 'Reconnecting in 60 seconds');
        setTimeout(() => {
          to_console(this, 'Reconnecting...');
          this.connect();
        }, 60000);
      }
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
      let handled = false;

      if ('error' in parsed) {
        handled = handle_rpc_error_response(this, parsed as RpcErrorResponse);
        if (handled) {
          return;
        }
      }

      if ('method' in parsed && parsed.method === 'subscription') {
        handled = handle_rpc_subscription_message(this, parsed as RpcSubscriptionMessage);
        on_message(parsed as RpcMessage);
        if (handled) {
          return;
        }
      }

      if ('result' in parsed) {
        handled = handle_rpc_success_response(this, parsed as RpcSuccessResponse);
        on_message(parsed as RpcMessage);
        if (handled) {
          return;
        }
      }

      to_console(this, 'Unhandled message', parsed);
      on_message(parsed as RpcMessage);
    };

    this.connect();
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
    };
  };

  public can_trade = (): boolean => this.auth_data.trade_permit;

  public get_index = (index: Indexes) => this.indexes_list[index];

  public get_pending_subscriptions = () => this.subscriptions_pending;

  public get_active_subscriptions = () => this.subscriptions_active;

  public get_obligatory_data_pending = () => this.obligatory_data_pending;

  public get_obligatory_data_received = () => this.obligatory_data_received;

  public get_account_summaries = () => this.account_summaries;

  public get_positions = () => this.positions;

  public get_deribit_instruments = (kind: Kinds) => this.deribit_instruments_list[kind];

  public get_deribit_instrument_by_name = (instrument_name: string) =>
    this.deribit_instruments_by_name[instrument_name];

  public get_deribit_currencies_list = () => this.deribit_currencies_list.list;

  public get_ticker_data = (instrument_name: string) => this.ticker_data[instrument_name];

  public get_raw_ticker_data = (instrument_name: string) => this.ticker_data[instrument_name]?.raw;

  public get_calculated_ticker_data = (instrument_name: string) =>
    this.ticker_data[instrument_name]?.calculated;

  public get_position_by_instrument_name = (instrument_name: string) =>
    this.positions[instrument_name];

  public get_orders = () => this.orders;

  public get_order_by_label = (label: string) => this.orders.all[label];

  public get_trades = () => this.trades;

  public get_trade_by_id = (trade_id: string): Trade | null => this.trades_by_id[trade_id] || null;

  public has_pending_orders = (): boolean => this.orders.pending_orders_amount > 0;

  public get_transactions_log = (currency: TransactionLogCurrencies) =>
    this.transactions_log[currency];
}
