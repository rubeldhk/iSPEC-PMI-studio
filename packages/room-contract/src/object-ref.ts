/**
 * T337k — how a Room addresses the thing it is governing.
 * `FR-RQR-003`, `FR-GEL-061`, `BR-0064`.
 *
 * `workflowType` is a **string, not a union of the three Rooms**, and the
 * looseness is deliberate on two counts:
 *
 *   - a closed union would make this shared contract know its consumers, so
 *     adding a Room would mean changing a package three Rooms import;
 *   - it would break the moment a fourth governed workflow is configured, which
 *     `BR-0064` explicitly permits — *"configurable per workflow type"* cannot
 *     mean *"one of three values somebody enumerated"*.
 *
 * `EPIC-030`'s `LoopObjectRef` draws the same line for the same reason. This
 * type is its Room-side counterpart and deliberately carries no more: no
 * subject, no title, no payload. Anything else here would be Room vocabulary in
 * the shared contract.
 */

export interface RoomObjectRef {
  /** Open by design — see above. Matches `EPIC-030`'s loop object. */
  readonly workflowType: string;
  /** The `EPIC-030` loop object this Room renders. */
  readonly objectId: string;
}
