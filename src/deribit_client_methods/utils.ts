import { RpcError } from '../types/types';
import { DeribitClient } from '../DeribitClient';
import { remove_elements_from_existing_array } from '@igorpronin/utils';
import { re_auth } from './auth_requests_and_handlers';

export function to_console(context: DeribitClient, msg: string, error?: RpcError) {
  if (error) {
    console.error(error);
  }
  if (!context.output_console) {
    return;
  }
  if (!error) {
    console.log(`${context.msg_prefix} ${msg}`);
  }
}

export function count_refresh(context: DeribitClient): any {
  return setInterval(() => {
    context.refresh_counter++;
    handle_refresh_counter(context);
  }, 1000);
}

export function handle_refresh_counter(context: DeribitClient) {
  if (context.refresh_counter === context.refresh_interval) {
    clearInterval(context.refresh_counter_id);
    context.refresh_counter = 0;
    re_auth(context);
  }
}

export function validate_if_instance_is_ready(context: DeribitClient) {
  const previous_state = context.is_instance_ready;
  context.is_instance_ready =
    context.pending_subscriptions.length === 0 && context.obligatory_data_pending.length === 0;
  const new_state = context.is_instance_ready;
  if (previous_state !== new_state && new_state) {
    context.ee.emit('instance_ready');
  }
}

export function init_pending_subscriptions_check(context: DeribitClient) {
  setTimeout(() => {
    if (context.pending_subscriptions.length) {
      let m = 'WARNING! Pending subscriptions still exist';
      context.pending_subscriptions.forEach((s: string) => {
        m += `\n   ${s}`;
      });
      to_console(context, m);
    }
  }, context.subscriptions_check_time * 1000);
}

export function hadle_opligatory_data_status(context: DeribitClient, id: string) {
  remove_elements_from_existing_array(context.obligatory_data_pending, id);
  if (!context.obligatory_data_received.includes(id)) {
    context.obligatory_data_received.push(id);
  }
}
