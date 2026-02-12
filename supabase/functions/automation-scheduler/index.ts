import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface Automation {
  id: string;
  company_id: string;
  name: string;
  trigger_type: string;
  conditions: any[];
  actions: any[];
  scheduling: any;
  is_enabled: boolean;
}

interface AutomationQueue {
  id: string;
  company_id: string;
  automation_id: string;
  status: string;
  current_step: number;
  pause_reason: string | null;
  resume_after: string | null;
  trigger_data: any;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase configuration missing');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const now = new Date().toISOString();

    const results = {
      time_delay_processed: 0,
      scheduled_datetime_processed: 0,
      recurring_schedule_processed: 0,
      resumed_wait_duration: 0,
      resumed_wait_until: 0,
      errors: [] as string[],
    };

    // 1. Process time_delay_trigger automations
    try {
      const delayResults = await processTimeDelayTriggers(supabase, now);
      results.time_delay_processed = delayResults;
    } catch (error) {
      const errorMsg = `Time delay error: ${error instanceof Error ? error.message : 'Unknown'}`;
      console.error(errorMsg);
      results.errors.push(errorMsg);
    }

    // 2. Process scheduled_datetime_trigger automations
    try {
      const scheduledResults = await processScheduledDatetimeTriggers(supabase, now);
      results.scheduled_datetime_processed = scheduledResults;
    } catch (error) {
      const errorMsg = `Scheduled datetime error: ${error instanceof Error ? error.message : 'Unknown'}`;
      console.error(errorMsg);
      results.errors.push(errorMsg);
    }

    // 3. Process recurring_schedule_trigger automations
    try {
      const recurringResults = await processRecurringScheduleTriggers(supabase, now);
      results.recurring_schedule_processed = recurringResults;
    } catch (error) {
      const errorMsg = `Recurring schedule error: ${error instanceof Error ? error.message : 'Unknown'}`;
      console.error(errorMsg);
      results.errors.push(errorMsg);
    }

    // 4. Resume paused automations waiting on wait_duration or wait_until
    try {
      const resumedResults = await resumePausedAutomations(supabase, now);
      results.resumed_wait_duration = resumedResults.wait_duration;
      results.resumed_wait_until = resumedResults.wait_until;
    } catch (error) {
      const errorMsg = `Resume paused error: ${error instanceof Error ? error.message : 'Unknown'}`;
      console.error(errorMsg);
      results.errors.push(errorMsg);
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed_at: now,
        results,
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );

  } catch (error) {
    console.error('Automation scheduler error:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});

async function processTimeDelayTriggers(supabase: any, now: string): Promise<number> {
  // Time delay triggers queue themselves with a scheduled_for time
  // This is handled by the queue system, not the scheduler
  // Just log that we checked
  console.log('Time delay triggers are processed by the queue system');
  return 0;
}

async function processScheduledDatetimeTriggers(supabase: any, now: string): Promise<number> {
  // Get all enabled automations with scheduled_datetime_trigger
  const { data: automations, error } = await supabase
    .from('automations')
    .select('*')
    .eq('trigger_type', 'scheduled_datetime_trigger')
    .eq('is_enabled', true);

  if (error) {
    console.error('Error fetching scheduled_datetime automations:', error);
    throw error;
  }

  if (!automations || automations.length === 0) {
    return 0;
  }

  let processed = 0;

  for (const automation of automations) {
    try {
      const scheduling = automation.scheduling || {};
      const scheduledDatetime = scheduling.scheduled_datetime;

      if (!scheduledDatetime) {
        console.log(`Automation ${automation.id} missing scheduled_datetime`);
        continue;
      }

      // Check if scheduled time has arrived
      const scheduledTime = new Date(scheduledDatetime);
      const currentTime = new Date(now);

      if (scheduledTime <= currentTime) {
        // Check if already queued recently (within last hour to avoid duplicates)
        const oneHourAgo = new Date(currentTime.getTime() - 60 * 60 * 1000).toISOString();

        const { data: existingQueue } = await supabase
          .from('automation_queue')
          .select('id')
          .eq('automation_id', automation.id)
          .eq('trigger_type', 'scheduled_datetime_trigger')
          .gte('created_at', oneHourAgo)
          .maybeSingle();

        if (existingQueue) {
          console.log(`Automation ${automation.id} already queued recently`);
          continue;
        }

        // Queue the automation
        const { error: queueError } = await supabase
          .from('automation_queue')
          .insert({
            company_id: automation.company_id,
            automation_id: automation.id,
            trigger_type: 'scheduled_datetime_trigger',
            trigger_data: {
              scheduled_time: scheduledDatetime,
              executed_at: now,
            },
            scheduled_for: now,
            status: 'pending',
          });

        if (queueError) {
          console.error(`Error queuing automation ${automation.id}:`, queueError);
          continue;
        }

        processed++;
        console.log(`Queued scheduled_datetime automation ${automation.id}`);

        // Optionally disable one-time scheduled automations
        if (!scheduling.repeat) {
          await supabase
            .from('automations')
            .update({ is_enabled: false })
            .eq('id', automation.id);

          console.log(`Disabled one-time automation ${automation.id}`);
        }
      }
    } catch (error) {
      console.error(`Error processing automation ${automation.id}:`, error);
    }
  }

  return processed;
}

async function processRecurringScheduleTriggers(supabase: any, now: string): Promise<number> {
  // Get all enabled automations with recurring_schedule_trigger
  const { data: automations, error } = await supabase
    .from('automations')
    .select('*')
    .eq('trigger_type', 'recurring_schedule_trigger')
    .eq('is_enabled', true);

  if (error) {
    console.error('Error fetching recurring_schedule automations:', error);
    throw error;
  }

  if (!automations || automations.length === 0) {
    return 0;
  }

  let processed = 0;
  const currentTime = new Date(now);

  for (const automation of automations) {
    try {
      const scheduling = automation.scheduling || {};
      const { frequency, time, days_of_week, day_of_month } = scheduling;

      if (!frequency) {
        console.log(`Automation ${automation.id} missing frequency`);
        continue;
      }

      let shouldRun = false;

      // Check if it's time to run based on frequency
      if (frequency === 'daily') {
        shouldRun = checkDailySchedule(currentTime, time);
      } else if (frequency === 'weekly') {
        shouldRun = checkWeeklySchedule(currentTime, time, days_of_week);
      } else if (frequency === 'monthly') {
        shouldRun = checkMonthlySchedule(currentTime, time, day_of_month);
      } else if (frequency === 'hourly') {
        shouldRun = checkHourlySchedule(currentTime, scheduling.minute_of_hour);
      }

      if (!shouldRun) {
        continue;
      }

      // Check if already queued recently (within last 50 minutes for hourly, 20 hours for daily/weekly/monthly)
      const lookbackMinutes = frequency === 'hourly' ? 50 : (20 * 60);
      const lookbackTime = new Date(currentTime.getTime() - lookbackMinutes * 60 * 1000).toISOString();

      const { data: existingQueue } = await supabase
        .from('automation_queue')
        .select('id')
        .eq('automation_id', automation.id)
        .eq('trigger_type', 'recurring_schedule_trigger')
        .gte('created_at', lookbackTime)
        .maybeSingle();

      if (existingQueue) {
        console.log(`Recurring automation ${automation.id} already queued recently`);
        continue;
      }

      // Queue the automation
      const { error: queueError } = await supabase
        .from('automation_queue')
        .insert({
          company_id: automation.company_id,
          automation_id: automation.id,
          trigger_type: 'recurring_schedule_trigger',
          trigger_data: {
            frequency,
            scheduled_time: currentTime.toISOString(),
          },
          scheduled_for: now,
          status: 'pending',
        });

      if (queueError) {
        console.error(`Error queuing recurring automation ${automation.id}:`, queueError);
        continue;
      }

      processed++;
      console.log(`Queued recurring automation ${automation.id} (${frequency})`);

    } catch (error) {
      console.error(`Error processing recurring automation ${automation.id}:`, error);
    }
  }

  return processed;
}

async function resumePausedAutomations(supabase: any, now: string): Promise<{ wait_duration: number; wait_until: number }> {
  // Find all pending queue items with resume_after <= now
  const { data: pausedItems, error } = await supabase
    .from('automation_queue')
    .select('*')
    .eq('status', 'pending')
    .not('resume_after', 'is', null)
    .lte('resume_after', now);

  if (error) {
    console.error('Error fetching paused automations:', error);
    throw error;
  }

  if (!pausedItems || pausedItems.length === 0) {
    return { wait_duration: 0, wait_until: 0 };
  }

  let waitDurationCount = 0;
  let waitUntilCount = 0;

  for (const item of pausedItems) {
    try {
      // Update the queue item to resume execution
      const { error: updateError } = await supabase
        .from('automation_queue')
        .update({
          resume_after: null,
          pause_reason: null,
          scheduled_for: now,
        })
        .eq('id', item.id);

      if (updateError) {
        console.error(`Error resuming automation queue ${item.id}:`, updateError);
        continue;
      }

      if (item.pause_reason === 'wait_duration') {
        waitDurationCount++;
      } else if (item.pause_reason === 'wait_until') {
        waitUntilCount++;
      }

      console.log(`Resumed paused automation ${item.id} (reason: ${item.pause_reason})`);

    } catch (error) {
      console.error(`Error processing paused item ${item.id}:`, error);
    }
  }

  return {
    wait_duration: waitDurationCount,
    wait_until: waitUntilCount,
  };
}

// Helper functions for schedule checking
function checkDailySchedule(currentTime: Date, scheduledTime: string | undefined): boolean {
  if (!scheduledTime) {
    return false;
  }

  const [hours, minutes] = scheduledTime.split(':').map(Number);
  const currentHours = currentTime.getHours();
  const currentMinutes = currentTime.getMinutes();

  // Check if current time matches scheduled time (within 5-minute window)
  return currentHours === hours && Math.abs(currentMinutes - minutes) < 5;
}

function checkWeeklySchedule(currentTime: Date, scheduledTime: string | undefined, daysOfWeek: number[] | undefined): boolean {
  if (!scheduledTime || !daysOfWeek || daysOfWeek.length === 0) {
    return false;
  }

  // Check if today is in the specified days (0 = Sunday, 6 = Saturday)
  const currentDay = currentTime.getDay();
  if (!daysOfWeek.includes(currentDay)) {
    return false;
  }

  return checkDailySchedule(currentTime, scheduledTime);
}

function checkMonthlySchedule(currentTime: Date, scheduledTime: string | undefined, dayOfMonth: number | undefined): boolean {
  if (!scheduledTime || !dayOfMonth) {
    return false;
  }

  // Check if today is the specified day of month
  const currentDay = currentTime.getDate();
  if (currentDay !== dayOfMonth) {
    return false;
  }

  return checkDailySchedule(currentTime, scheduledTime);
}

function checkHourlySchedule(currentTime: Date, minuteOfHour: number | undefined): boolean {
  const currentMinutes = currentTime.getMinutes();
  const targetMinute = minuteOfHour || 0;

  // Check if current minute matches target minute (within 5-minute window)
  return Math.abs(currentMinutes - targetMinute) < 5;
}
