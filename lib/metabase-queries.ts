// Dashboard queries against the P6 SQL Server database via Metabase.
//
// P6's database proj_id is the same value the P6 REST API exposes as the
// project ObjectId (verified against the live systems), so all queries filter
// with the ObjectIds the rest of this app already works with.

import { runNativeQuery } from "@/lib/metabase";

const PERCENT_COMPLETE_SQL = `
SELECT
    proj.proj_id                                            AS "ProjectObjectId",
    proj.proj_short_name                                    AS "Project",
    ROUND(
        100.0 * SUM(
            CASE
                WHEN t.status_code = 'TK_Complete' THEN t.target_drtn_hr_cnt
                ELSE t.target_drtn_hr_cnt - t.remain_drtn_hr_cnt
            END
        ) / NULLIF(SUM(t.target_drtn_hr_cnt), 0)
    , 1)                                                    AS "% Complete"
FROM privuser.TASK t
JOIN privuser.PROJECT proj ON proj.proj_id = t.proj_id
WHERE task_type IN ('TT_Task', 'TT_Rsrc')
  AND proj.proj_short_name != 'Residential Template'
  [[AND proj.proj_id = {{project_object_id}}]]
GROUP BY proj.proj_id, proj.proj_short_name
ORDER BY proj.proj_short_name
`;

export interface ProjectPercentComplete {
  projectObjectId: number;
  project: string;
  percentComplete: number | null;
}

/**
 * % complete per project, weighted by target duration hours.
 * Pass a P6 project ObjectId to filter to a single project; omit for all.
 */
export async function getProjectPercentComplete(
  projectObjectId?: number,
): Promise<ProjectPercentComplete[]> {
  const result = await runNativeQuery(PERCENT_COMPLETE_SQL, {
    project_object_id: projectObjectId,
  });
  return result.rows.map((row) => ({
    projectObjectId: Number(row[0]),
    project: String(row[1]),
    percentComplete: row[2] === null ? null : Number(row[2]),
  }));
}

const LATE_ACTIVITIES_SQL = `
SELECT COUNT(*) AS "Late Activities"
FROM privuser.TASK t
JOIN privuser.PROJECT proj ON proj.proj_id = t.proj_id
WHERE task_type IN ('TT_Task', 'TT_Rsrc', 'TT_Mile', 'TT_FinMile')
  AND t.target_end_date < GETDATE()
  AND t.status_code != 'TK_Complete'
  AND proj.proj_short_name != 'Residential Template'
  [[AND proj.proj_id = {{project_object_id}}]]
`;

/** Count of incomplete activities past their target end date. */
export async function getLateActivitiesCount(
  projectObjectId?: number,
): Promise<number> {
  const result = await runNativeQuery(LATE_ACTIVITIES_SQL, {
    project_object_id: projectObjectId,
  });
  return Number(result.rows[0]?.[0] ?? 0);
}

const PHASE_COMPLETION_SQL = `
SELECT
    proj.proj_short_name                                    AS "Project",
    phase.wbs_name                                          AS "Phase",
    phase.seq_num                                           AS "Phase Order",
    ROUND(
        100.0 * SUM(
            CASE
                WHEN t.status_code = 'TK_Complete' THEN t.target_drtn_hr_cnt
                ELSE t.target_drtn_hr_cnt - t.remain_drtn_hr_cnt
            END
        ) / NULLIF(SUM(t.target_drtn_hr_cnt), 0)
    , 1)                                                    AS "% Complete"
FROM privuser.TASK t
JOIN  privuser.PROJECT proj ON proj.proj_id = t.proj_id
JOIN  privuser.PROJWBS wbs  ON wbs.wbs_id   = t.wbs_id
LEFT JOIN privuser.PROJWBS p1 ON p1.wbs_id  = wbs.parent_wbs_id
JOIN (
    SELECT w.wbs_id, w.wbs_name, w.seq_num, w.proj_id
    FROM privuser.PROJWBS w
    JOIN      privuser.PROJWBS par  ON par.wbs_id  = w.parent_wbs_id
                                   AND par.proj_id  = w.proj_id
    LEFT JOIN privuser.PROJWBS gpar ON gpar.wbs_id = par.parent_wbs_id
                                   AND gpar.proj_id = w.proj_id
    WHERE gpar.wbs_id IS NULL
) AS phase ON phase.proj_id      = t.proj_id
          AND (   t.wbs_id        = phase.wbs_id
               OR wbs.parent_wbs_id = phase.wbs_id
               OR p1.parent_wbs_id  = phase.wbs_id )
WHERE task_type IN ('TT_Task', 'TT_Rsrc')
  AND proj.proj_short_name != 'Residential Template'
  [[AND proj.proj_id = {{project_object_id}}]]
GROUP BY proj.proj_short_name, phase.wbs_name, phase.seq_num
ORDER BY proj.proj_short_name, phase.seq_num
`;

export interface PhaseCompletion {
  project: string;
  phase: string;
  phaseOrder: number;
  percentComplete: number | null;
}

/** % complete per top-level WBS phase, ordered by phase sequence. */
export async function getPhaseCompletion(
  projectObjectId?: number,
): Promise<PhaseCompletion[]> {
  const result = await runNativeQuery(PHASE_COMPLETION_SQL, {
    project_object_id: projectObjectId,
  });
  return result.rows.map((row) => ({
    project: String(row[0]),
    phase: String(row[1]),
    phaseOrder: Number(row[2]),
    percentComplete: row[3] === null ? null : Number(row[3]),
  }));
}

const STATUS_BREAKDOWN_SQL = `
SELECT
    proj.proj_short_name                                    AS "Project",
    CASE t.status_code
        WHEN 'TK_Complete' THEN 'Complete'
        WHEN 'TK_Active'   THEN 'In Progress'
        WHEN 'TK_NotStart' THEN 'Not Started'
    END                                                     AS "Status",
    COUNT(*)                                                AS "Activities"
FROM privuser.TASK t
JOIN privuser.PROJECT proj ON proj.proj_id = t.proj_id
WHERE task_type IN ('TT_Task', 'TT_Rsrc')
  AND proj.proj_short_name != 'Residential Template'
  [[AND proj.proj_id = {{project_object_id}}]]
GROUP BY proj.proj_short_name, t.status_code
ORDER BY proj.proj_short_name, t.status_code
`;

export interface ActivityStatusCount {
  project: string;
  status: string;
  activities: number;
}

/** Activity counts grouped by status (Complete / In Progress / Not Started). */
export async function getActivityStatusBreakdown(
  projectObjectId?: number,
): Promise<ActivityStatusCount[]> {
  const result = await runNativeQuery(STATUS_BREAKDOWN_SQL, {
    project_object_id: projectObjectId,
  });
  return result.rows.map((row) => ({
    project: String(row[0]),
    status: String(row[1]),
    activities: Number(row[2]),
  }));
}

const MILESTONES_SQL = `
SELECT
    t.task_code                                             AS "ID",
    t.task_name                                             AS "Milestone",
    proj.proj_short_name                                    AS "Project",
    CAST(t.target_end_date AS DATE)                         AS "Target Date",
    CAST(t.act_end_date    AS DATE)                         AS "Actual Date",
    CASE
        WHEN t.status_code = 'TK_Complete'                                      THEN 'Complete'
        WHEN t.target_end_date < GETDATE() AND t.status_code != 'TK_Complete'   THEN 'Late'
        WHEN t.total_float_hr_cnt <= 40    AND t.status_code != 'TK_Complete'   THEN 'At Risk'
        ELSE 'On Track'
    END                                                     AS "Status",
    CASE
        WHEN t.status_code = 'TK_Complete' AND t.act_end_date > t.target_end_date
            THEN CAST(DATEDIFF(day, t.target_end_date, t.act_end_date) AS VARCHAR) + ' days late'
        WHEN t.status_code = 'TK_Complete' AND t.act_end_date < t.target_end_date
            THEN CAST(DATEDIFF(day, t.act_end_date, t.target_end_date) AS VARCHAR) + ' days early'
        WHEN t.status_code = 'TK_Complete'
            THEN 'On time'
        WHEN t.target_end_date < GETDATE()
            THEN CAST(DATEDIFF(day, t.target_end_date, GETDATE()) AS VARCHAR) + ' days late'
        WHEN t.target_end_date > GETDATE()
            THEN CAST(DATEDIFF(day, GETDATE(), t.target_end_date) AS VARCHAR) + ' days early'
        ELSE 'On time'
    END                                                     AS "Variance"
FROM privuser.TASK t
JOIN privuser.PROJECT proj ON proj.proj_id = t.proj_id
WHERE task_type IN ('TT_Mile', 'TT_FinMile')
  AND proj.proj_short_name != 'Residential Template'
  [[AND proj.proj_id = {{project_object_id}}]]
ORDER BY t.target_end_date
`;

export type MilestoneStatus = "Complete" | "Late" | "At Risk" | "On Track";

export interface Milestone {
  id: string;
  milestone: string;
  project: string;
  targetDate: string | null;
  actualDate: string | null;
  status: MilestoneStatus;
  variance: string;
}

/** Milestone activities with target/actual dates, status, and variance. */
export async function getMilestones(
  projectObjectId?: number,
): Promise<Milestone[]> {
  const result = await runNativeQuery(MILESTONES_SQL, {
    project_object_id: projectObjectId,
  });
  return result.rows.map((row) => ({
    id: String(row[0]),
    milestone: String(row[1]),
    project: String(row[2]),
    targetDate: row[3] === null ? null : String(row[3]),
    actualDate: row[4] === null ? null : String(row[4]),
    status: String(row[5]) as MilestoneStatus,
    variance: String(row[6]),
  }));
}

// Reusable top-level WBS "phase" join: each task is matched to its top-level
// phase whether it sits 1, 2, or 3 WBS levels below it.
const PHASE_JOIN_SQL = `
JOIN  privuser.PROJWBS wbs  ON wbs.wbs_id   = t.wbs_id
LEFT JOIN privuser.PROJWBS p1 ON p1.wbs_id  = wbs.parent_wbs_id
JOIN (
    SELECT w.wbs_id, w.wbs_name, w.seq_num, w.proj_id
    FROM privuser.PROJWBS w
    JOIN      privuser.PROJWBS par  ON par.wbs_id  = w.parent_wbs_id
                                   AND par.proj_id  = w.proj_id
    LEFT JOIN privuser.PROJWBS gpar ON gpar.wbs_id = par.parent_wbs_id
                                   AND gpar.proj_id = w.proj_id
    WHERE gpar.wbs_id IS NULL
) AS phase ON phase.proj_id      = t.proj_id
          AND (   t.wbs_id        = phase.wbs_id
               OR wbs.parent_wbs_id = phase.wbs_id
               OR p1.parent_wbs_id  = phase.wbs_id )
`;

const PHASE_STATUS_COUNTS_SQL = `
SELECT
    phase.wbs_name                                          AS "Phase",
    phase.seq_num                                           AS "Phase Order",
    CASE t.status_code
        WHEN 'TK_Complete' THEN 'Complete'
        WHEN 'TK_Active'   THEN 'In Progress'
        WHEN 'TK_NotStart' THEN 'Not Started'
    END                                                     AS "Status",
    COUNT(*)                                                AS "Activities"
FROM privuser.TASK t
JOIN privuser.PROJECT proj ON proj.proj_id = t.proj_id
${PHASE_JOIN_SQL}
WHERE task_type IN ('TT_Task', 'TT_Rsrc')
  AND proj.proj_short_name != 'Residential Template'
  [[AND proj.proj_id = {{project_object_id}}]]
GROUP BY phase.wbs_name, phase.seq_num, t.status_code
ORDER BY phase.seq_num, t.status_code
`;

export interface PhaseStatusCount {
  phase: string;
  phaseOrder: number;
  status: string;
  activities: number;
}

/** Activity counts per top-level WBS phase, split by status. */
export async function getPhaseStatusCounts(
  projectObjectId?: number,
): Promise<PhaseStatusCount[]> {
  const result = await runNativeQuery(PHASE_STATUS_COUNTS_SQL, {
    project_object_id: projectObjectId,
  });
  return result.rows.map((row) => ({
    phase: String(row[0]),
    phaseOrder: Number(row[1]),
    status: String(row[2]),
    activities: Number(row[3]),
  }));
}

const VARIANCE_TABLE_SQL = `
SELECT
    t.task_code                                             AS "ID",
    t.task_name                                             AS "Activity",
    phase.wbs_name                                          AS "Phase",
    CASE t.status_code
        WHEN 'TK_Active'   THEN 'In Progress'
        WHEN 'TK_NotStart' THEN 'Not Started'
    END                                                     AS "Status",
    CAST(t.target_start_date AS DATE)                       AS "Planned Start",
    CAST(t.target_end_date   AS DATE)                       AS "Planned Finish",
    DATEDIFF(day, t.target_end_date, GETDATE())             AS "Days Late",
    t.total_float_hr_cnt / 8.0                              AS "Float (days)",
    ROUND(t.remain_drtn_hr_cnt / 8.0, 0)                    AS "Remaining (days)"
FROM privuser.TASK t
JOIN privuser.PROJECT proj ON proj.proj_id = t.proj_id
${PHASE_JOIN_SQL}
WHERE task_type IN ('TT_Task', 'TT_Rsrc')
  AND t.target_end_date < GETDATE()
  AND t.status_code != 'TK_Complete'
  AND proj.proj_short_name != 'Residential Template'
  [[AND proj.proj_id = {{project_object_id}}]]
ORDER BY DATEDIFF(day, t.target_end_date, GETDATE()) DESC
`;

export interface VarianceRow {
  id: string;
  activity: string;
  phase: string;
  status: string;
  plannedStart: string | null;
  plannedFinish: string | null;
  daysLate: number;
  floatDays: number | null;
  remainingDays: number | null;
}

/** Incomplete activities past their planned finish, most-late first. */
export async function getVarianceTable(
  projectObjectId?: number,
): Promise<VarianceRow[]> {
  const result = await runNativeQuery(VARIANCE_TABLE_SQL, {
    project_object_id: projectObjectId,
  });
  return result.rows.map((row) => ({
    id: String(row[0]),
    activity: String(row[1]),
    phase: String(row[2]),
    status: String(row[3]),
    plannedStart: row[4] === null ? null : String(row[4]),
    plannedFinish: row[5] === null ? null : String(row[5]),
    daysLate: Number(row[6]),
    floatDays: row[7] === null ? null : Number(row[7]),
    remainingDays: row[8] === null ? null : Number(row[8]),
  }));
}

const START_VARIANCE_SQL = `
SELECT
    t.task_code                                             AS "ID",
    t.task_name                                             AS "Activity",
    phase.wbs_name                                          AS "Phase",
    CAST(t.target_start_date AS DATE)                       AS "Planned Start",
    CAST(t.act_start_date    AS DATE)                       AS "Actual Start",
    DATEDIFF(day, t.target_start_date, t.act_start_date)    AS "Start Variance (days)"
FROM privuser.TASK t
JOIN privuser.PROJECT proj ON proj.proj_id = t.proj_id
${PHASE_JOIN_SQL}
WHERE t.task_type IN ('TT_Task', 'TT_Rsrc')
  AND t.act_start_date IS NOT NULL
  AND proj.proj_short_name != 'Residential Template'
  [[AND proj.proj_id = {{project_object_id}}]]
ORDER BY t.target_start_date
`;

export interface StartVariancePoint {
  id: string;
  activity: string;
  phase: string;
  plannedStart: string | null;
  actualStart: string | null;
  varianceDays: number | null;
}

/** Started activities with planned vs. actual start variance in days. */
export async function getStartVariance(
  projectObjectId?: number,
): Promise<StartVariancePoint[]> {
  const result = await runNativeQuery(START_VARIANCE_SQL, {
    project_object_id: projectObjectId,
  });
  return result.rows.map((row) => ({
    id: String(row[0]),
    activity: String(row[1]),
    phase: String(row[2]),
    plannedStart: row[3] === null ? null : String(row[3]),
    actualStart: row[4] === null ? null : String(row[4]),
    varianceDays: row[5] === null ? null : Number(row[5]),
  }));
}

const REMAINING_DURATION_SQL = `
SELECT
    phase.wbs_name                                          AS "Phase",
    phase.seq_num                                           AS "Phase Order",
    ROUND(SUM(t.remain_drtn_hr_cnt / 8.0), 0)               AS "Remaining (days)"
FROM privuser.TASK t
JOIN privuser.PROJECT proj ON proj.proj_id = t.proj_id
${PHASE_JOIN_SQL}
WHERE t.task_type IN ('TT_Task', 'TT_Rsrc')
  AND t.status_code != 'TK_Complete'
  AND proj.proj_short_name != 'Residential Template'
  [[AND proj.proj_id = {{project_object_id}}]]
GROUP BY phase.wbs_name, phase.seq_num
ORDER BY phase.seq_num
`;

export interface PhaseRemainingDuration {
  phase: string;
  phaseOrder: number;
  remainingDays: number | null;
}

/** Total remaining duration (work days) per top-level WBS phase. */
export async function getRemainingDurationByPhase(
  projectObjectId?: number,
): Promise<PhaseRemainingDuration[]> {
  const result = await runNativeQuery(REMAINING_DURATION_SQL, {
    project_object_id: projectObjectId,
  });
  return result.rows.map((row) => ({
    phase: String(row[0]),
    phaseOrder: Number(row[1]),
    remainingDays: row[2] === null ? null : Number(row[2]),
  }));
}

export interface ProjectDashboardData {
  percentComplete: number | null;
  lateActivities: number;
  phases: PhaseCompletion[];
  statusBreakdown: ActivityStatusCount[];
  milestones: Milestone[];
  phaseStatusCounts: PhaseStatusCount[];
  varianceRows: VarianceRow[];
  startVariance: StartVariancePoint[];
  remainingByPhase: PhaseRemainingDuration[];
}

/** All dashboard widgets for one project, fetched in parallel. */
export async function getProjectDashboard(
  projectObjectId: number,
): Promise<ProjectDashboardData> {
  const [
    percent,
    late,
    phases,
    statusBreakdown,
    milestones,
    phaseStatusCounts,
    varianceRows,
    startVariance,
    remainingByPhase,
  ] = await Promise.all([
    getProjectPercentComplete(projectObjectId),
    getLateActivitiesCount(projectObjectId),
    getPhaseCompletion(projectObjectId),
    getActivityStatusBreakdown(projectObjectId),
    getMilestones(projectObjectId),
    getPhaseStatusCounts(projectObjectId),
    getVarianceTable(projectObjectId),
    getStartVariance(projectObjectId),
    getRemainingDurationByPhase(projectObjectId),
  ]);
  return {
    percentComplete: percent[0]?.percentComplete ?? null,
    lateActivities: late,
    phases,
    statusBreakdown,
    milestones,
    phaseStatusCounts,
    varianceRows,
    startVariance,
    remainingByPhase,
  };
}
