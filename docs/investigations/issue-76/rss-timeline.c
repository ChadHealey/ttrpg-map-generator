#include <libproc.h>
#include <mach/mach_time.h>
#include <pthread.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <time.h>

#define MAX_PIDS 64

static double milliseconds(uint64_t ticks, mach_timebase_info_data_t timebase) {
  return (double)ticks * (double)timebase.numer / (double)timebase.denom / 1000000.0;
}

int main(int argc, char **argv) {
  if (argc < 5 || argc > MAX_PIDS + 4) {
    fprintf(stderr, "usage: %s duration-seconds interval-ms output.csv pid...\n", argv[0]);
    return 2;
  }
  const double duration_ms = strtod(argv[1], NULL) * 1000.0;
  pthread_set_qos_class_self_np(QOS_CLASS_USER_INTERACTIVE, 0);
  const long interval_ns = strtol(argv[2], NULL, 10) * 1000000L;
  const struct timespec interval = {.tv_sec = interval_ns / 1000000000L,
                                    .tv_nsec = interval_ns % 1000000000L};
  FILE *output = fopen(argv[3], "w");
  if (output == NULL) return 3;
  mach_timebase_info_data_t timebase;
  mach_timebase_info(&timebase);
  struct timespec realtime;
  clock_gettime(CLOCK_REALTIME, &realtime);
  const double epoch_ms =
      (double)realtime.tv_sec * 1000.0 + (double)realtime.tv_nsec / 1000000.0;
  const uint64_t started = mach_continuous_time();
  uint64_t previous = started;
  double maximum_interval_ms = 0.0;
  unsigned long samples = 0;
  fprintf(output, "epoch_ms,aggregate_rss_bytes");
  for (int index = 4; index < argc; index += 1) fprintf(output, ",pid_%s", argv[index]);
  fputc('\n', output);
  while (milliseconds(mach_continuous_time() - started, timebase) < duration_ms) {
    const uint64_t sample_started = mach_continuous_time();
    const double elapsed_ms = milliseconds(sample_started - started, timebase);
    const double observed_interval_ms = milliseconds(sample_started - previous, timebase);
    if (samples > 0 && observed_interval_ms > maximum_interval_ms) {
      maximum_interval_ms = observed_interval_ms;
    }
    previous = sample_started;
    uint64_t aggregate_rss = 0;
    uint64_t per_pid_rss[MAX_PIDS] = {0};
    for (int index = 4; index < argc; index += 1) {
      struct proc_taskinfo info;
      const int pid = atoi(argv[index]);
      if (proc_pidinfo(pid, PROC_PIDTASKINFO, 0, &info, sizeof(info)) == sizeof(info)) {
        per_pid_rss[index - 4] = info.pti_resident_size;
        aggregate_rss += info.pti_resident_size;
      }
    }
    fprintf(output, "%.3f,%llu", epoch_ms + elapsed_ms, aggregate_rss);
    for (int index = 4; index < argc; index += 1) {
      fprintf(output, ",%llu", per_pid_rss[index - 4]);
    }
    fputc('\n', output);
    samples += 1;
    nanosleep(&interval, NULL);
  }
  fclose(output);
  fprintf(stderr, "samples=%lu max_interval_ms=%.3f\n", samples, maximum_interval_ms);
  return 0;
}
