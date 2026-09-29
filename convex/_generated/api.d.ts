/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as assignments from "../assignments.js";
import type * as auth from "../auth.js";
import type * as crons from "../crons.js";
import type * as events from "../events.js";
import type * as http from "../http.js";
import type * as lib_aggregates from "../lib/aggregates.js";
import type * as lib_allianceDraft from "../lib/allianceDraft.js";
import type * as lib_assignments from "../lib/assignments.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_consensus from "../lib/consensus.js";
import type * as lib_constants from "../lib/constants.js";
import type * as lib_errors from "../lib/errors.js";
import type * as lib_event from "../lib/event.js";
import type * as lib_history from "../lib/history.js";
import type * as lib_ordering from "../lib/ordering.js";
import type * as lib_ranking from "../lib/ranking.js";
import type * as lib_rpPrediction from "../lib/rpPrediction.js";
import type * as lib_stats from "../lib/stats.js";
import type * as lib_tba from "../lib/tba.js";
import type * as lib_tiers from "../lib/tiers.js";
import type * as lib_validators from "../lib/validators.js";
import type * as matchScouting from "../matchScouting.js";
import type * as matches from "../matches.js";
import type * as pickLists from "../pickLists.js";
import type * as pit from "../pit.js";
import type * as presence from "../presence.js";
import type * as teams from "../teams.js";
import type * as users from "../users.js";
import type * as warGames from "../warGames.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  assignments: typeof assignments;
  auth: typeof auth;
  crons: typeof crons;
  events: typeof events;
  http: typeof http;
  "lib/aggregates": typeof lib_aggregates;
  "lib/allianceDraft": typeof lib_allianceDraft;
  "lib/assignments": typeof lib_assignments;
  "lib/auth": typeof lib_auth;
  "lib/consensus": typeof lib_consensus;
  "lib/constants": typeof lib_constants;
  "lib/errors": typeof lib_errors;
  "lib/event": typeof lib_event;
  "lib/history": typeof lib_history;
  "lib/ordering": typeof lib_ordering;
  "lib/ranking": typeof lib_ranking;
  "lib/rpPrediction": typeof lib_rpPrediction;
  "lib/stats": typeof lib_stats;
  "lib/tba": typeof lib_tba;
  "lib/tiers": typeof lib_tiers;
  "lib/validators": typeof lib_validators;
  matchScouting: typeof matchScouting;
  matches: typeof matches;
  pickLists: typeof pickLists;
  pit: typeof pit;
  presence: typeof presence;
  teams: typeof teams;
  users: typeof users;
  warGames: typeof warGames;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
