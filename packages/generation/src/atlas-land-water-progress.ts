/** Monotonic progress reporting and cooperative cancellation observation for costly atlas work. */

import type {
  AtlasGenerationStage,
  AtlasLandWaterGenerationRuntime,
} from './atlas-land-water-generator-contract.js';
import {
  ATLAS_GENERATION_PROGRESS_TOTAL_WORK,
  ATLAS_LAND_WATER_PROGRESS_VERSION,
} from './atlas-land-water-generator-metadata.js';
import {
  type WORLD_ATLAS_FULL_PROFILE,
  type WORLD_ATLAS_PREVIEW_PROFILE,
} from './atlas-sampling-profiles.js';

export class AtlasLandWaterProgressReporter {
  readonly #runtime: AtlasLandWaterGenerationRuntime;
  readonly #profileId:
    typeof WORLD_ATLAS_PREVIEW_PROFILE.profileId | typeof WORLD_ATLAS_FULL_PROFILE.profileId;
  #completedWork = 0;
  #stageCompletedWork = 0;
  #stageTotalWork = 1;
  #lastCancellationRequested = false;
  #hasTerminalEvent = false;

  public constructor(
    runtime: AtlasLandWaterGenerationRuntime,
    profileId:
      typeof WORLD_ATLAS_PREVIEW_PROFILE.profileId | typeof WORLD_ATLAS_FULL_PROFILE.profileId,
  ) {
    this.#runtime = runtime;
    this.#profileId = profileId;
  }

  public cooperation(
    stage: AtlasGenerationStage,
    rangeStart: number,
    rangeEnd: number,
  ): { readonly cooperate: (completed: number, total: number) => Promise<boolean> } {
    return Object.freeze({
      cooperate: (completed, total) =>
        this.cooperateOnce(stage, completed, total, rangeStart, rangeEnd),
    });
  }

  public async cooperateOnce(
    stage: AtlasGenerationStage,
    completed: number,
    total: number,
    rangeStart: number,
    rangeEnd: number,
  ): Promise<boolean> {
    const ratio = total === 0 ? 1 : completed / total;
    const work = Math.max(
      this.#completedWork,
      Math.min(rangeEnd, Math.floor(rangeStart + (rangeEnd - rangeStart) * ratio)),
    );
    this.report(stage, completed, total, work, work);
    await this.#runtime.yieldControl();
    return this.isCancellationRequested();
  }

  public isCancellationRequested(): boolean {
    const isRequested = this.#runtime.cancellation.isCancellationRequested();
    this.#lastCancellationRequested = isRequested;
    return isRequested;
  }

  public report(
    stage: AtlasGenerationStage,
    stageCompletedWork: number,
    stageTotalWork: number,
    completedWork: number,
    minimumCompletedWork: number,
  ): void {
    this.#emit(
      stage,
      stageCompletedWork,
      stageTotalWork,
      completedWork,
      minimumCompletedWork,
      this.isCancellationRequested(),
      false,
    );
  }

  public cancel(): void {
    this.#emit(
      'cancelled',
      this.#stageCompletedWork,
      this.#stageTotalWork,
      this.#completedWork,
      this.#completedWork,
      this.#lastCancellationRequested,
      true,
    );
  }

  public fail(): void {
    this.#emit(
      'failed',
      this.#stageCompletedWork,
      this.#stageTotalWork,
      this.#completedWork,
      this.#completedWork,
      this.#lastCancellationRequested,
      true,
    );
  }

  public complete(): void {
    this.#emit(
      'completed',
      1,
      1,
      ATLAS_GENERATION_PROGRESS_TOTAL_WORK,
      ATLAS_GENERATION_PROGRESS_TOTAL_WORK,
      this.#lastCancellationRequested,
      true,
    );
  }

  #emit(
    stage: AtlasGenerationStage,
    stageCompletedWork: number,
    stageTotalWork: number,
    completedWork: number,
    minimumCompletedWork: number,
    isCancellationRequested: boolean,
    isTerminal: boolean,
  ): void {
    if (this.#hasTerminalEvent) return;
    this.#completedWork = Math.max(this.#completedWork, completedWork, minimumCompletedWork);
    this.#stageCompletedWork = stageCompletedWork;
    this.#stageTotalWork = stageTotalWork;
    this.#runtime.reportProgress(
      Object.freeze({
        progressVersion: ATLAS_LAND_WATER_PROGRESS_VERSION,
        operationId: this.#runtime.operationId,
        profileId: this.#profileId,
        stage,
        completedWork: this.#completedWork,
        totalWork: ATLAS_GENERATION_PROGRESS_TOTAL_WORK,
        stageCompletedWork,
        stageTotalWork,
        isCancellationRequested,
        isTerminal,
      }),
    );
    if (isTerminal) this.#hasTerminalEvent = true;
  }
}
