# athletedata

The `athletedata` MCP server holds this user's own training and health data
from the apps they connected at athletedata.health (Garmin, Oura, WHOOP, Hevy,
Apple Health, Intervals.icu and more). When they ask about their workouts,
training load, HRV, sleep, recovery, readiness, nutrition or race predictions,
call its tools instead of guessing or asking them to paste numbers.

- Start broad (`get_analytics_summary`, `get_readiness_today`,
  `get_pmc_status`), then drill into one activity or provider.
- Provider tools are prefixed (`garmin_`, `oura_`, `whoop_`, ...); only
  connected apps return data.
- Tools that write (`push_workout_to_watch`, `food_log_entry`,
  `hevy_create_routine`, ...) change the user's own accounts. Confirm first.
- Strava data is not available over MCP: Strava's API terms do not allow serving it to third-party AI tools.
