// Errors
export const ESuccess: number = 0;      // Generic success
export const EFail: number = 1;         // Generic failure
export const EFull: number = 2;         // Too many clients attached to this session; try later
export const ERetry: number = 3;        // Try request again
export const ENoSession: number = 4;		// No record of such session
export const EClockSeen: number = 5;
export const EClockFailure: number = 6;
export const EClockReset: number = 7;
export const ENoUser: number = 8;       // No user specified (internal error since all authorized reqs have user)
export const EBadRequest: number = 9;   // Badly formed request
export const ELoadFailed: number = 10;  // Session exists in index, but load of state failed ((temp?) internal error)
export const ENoPerm: number = 11;      // No permissions (readonly)
export const ENoAccess: number = 12;    // No access (no read)
export const EMaintenance: number = 13; // Server under maintenance
export const EClockAnomaly: number = 14;  // Typically server restart and client is ahead

// Filters
export const FilterMyMaps: number = 0;
export const FilterSharedWithMe: number = 1;
export const FilterMyPublic: number = 2;
export const FilterRecent: number = 3;
export const FilterTrash: number = 4;
export const FilterPublic: number = 5;
export const FilterOfficial: number = 6;
export const FilterCOI: number = 7;
export const FilterMyGroups: number = 8;
export const FilterCount: number = 9;
export type Filter = number;

// Permissions
export const PermNone: number = 0;      // No permissions
export const PermRead: number = 1;      // Can view
export const PermWrite: number = 2;     // Can modify
export const PermOwner: number = 4;     // Can change deleted, published, access permissions
export const PermAdmin: number = 8;     // Can administer site
export const PermEdit: number = (PermWrite|PermOwner);
export const PermAll: number = (PermRead|PermWrite|PermOwner|PermAdmin);
export type Permission = number;

// Server State
export const ServerStateRunning: number = 0;
export const ServerStateMaintenance: number = 1;
export type ServerState = number;

// Maps Access Tokens (IDs) to SessionID
export interface AccessSessionMap
{
  [key: string]: string;
}

// Maps Access ID to { list of users, permission } (stored with session)
export interface AccessMap
{
  [key: string]: Access;
}

export interface Access
{
  userIDs: string[];  // empty implies "anyone"
  perm: Permission;
}

export interface Revision
{
  id: string;
  modifyTime: any;  // JSON date
  label?: string;   // optional label
}

export type RevisionList = Revision[];

export interface SessionUser
{
	id: string;
	name: string;
  twitterhandle: string;
}

export interface ActiveUser
{
	id: string;
	name: string;
  twitterhandle: string;
	active: number;
}

export interface SessionUserIndex
{
	[key: string]: SessionUser;
}

export interface SessionUserList
{
	[key: string]: number;
}

export interface SessionProps
{
  id: string;
  name: string;
  type: string;
  description: string;
  labels: string[];
  createdBy: string;
  lastActive: any;		// JSON date (should be string)
  createTime: any;    // JSON date (should be string)
  modifyTime: any;    // JSON date (should be string)
  clientCount: number;
  maxClients: number;
  requestCount: number;
  deleted: boolean;
  published?: string;
  official: boolean;
	loadFailed: boolean;
  accessMap: AccessMap;
  revisions: RevisionList;
  expunged?: boolean;
  expungeDate?: string;
  xprops?: { [prop: string]: string };
  groups: any;  // DT.GroupsMapIndex
  xid?: string; // external ID
}

// True to add, False to remove
export type LabelUpdate = { [name: string]: boolean|null }

export interface SessionUpdateProps
{
	id?: string;
  xid?: string;
  ids?: string[];
	deleted?: boolean;
	published?: boolean;
	official?: boolean;
  name?: string;
  description?: string;
  labelupdate?: LabelUpdate;
  access?: Access;
  accessUpdate?: AccessMap;
  restore?: string; // Revision ID
  revision?: Revision;  // If ID is empty, snap a new revision, otherwise label it.
}

export interface SessionsIndex
{
	[key: string]: SessionProps;
}

// The semantics here are:
//  if aid is provided, only look through that access token.
//  if aid is missing, look for that user in any access token (but ignore anonymous tokens).
//  in either case, return the full set of permissions a user has.
//
export function accessFindUser(a: Access, uid: string): Permission
{
  if (a === undefined) return PermNone;
  if (a.userIDs.length == 0)
    return a.perm;
  for (let i: number = 0; i < a.userIDs.length; i++)
    if (a.userIDs[i] === uid) return a.perm;
  return PermNone;
}

export function accessMapFindUser(accessMap: AccessMap, uid: string, aid?: string): Permission
{
  if (aid !== undefined)
    return accessFindUser(accessMap[aid], uid);
  else
  {
    let perm: Permission = PermNone;
    for (var aid1 in accessMap) if (accessMap.hasOwnProperty(aid1))
    {
      let a = accessMap[aid1];
      for (let i: number = 0; i < a.userIDs.length; i++)
        if (a.userIDs[i] === uid)
        {
          perm |= a.perm;
          break;
        }
    }
    return perm;
  }
}

export function SessionFilterFunction(p: SessionProps, uid: string, f: number): boolean
{
	if (f === FilterPublic) return p.published !== undefined;

	if (f === FilterSharedWithMe)
	{
		if (p.createdBy === uid) return false;
    return true;
	}

	// All other filters require ownership of this session
	if (p.createdBy !== uid) return false;

	if (f === FilterTrash) return p.deleted;

  if (f === FilterRecent && !p.deleted && p.modifyTime)
  {
    let d = new Date();
    let interval = d.getTime() - new Date(p.modifyTime).getTime();
    return interval < (1000 * 60 * 60 * 24 * 7);  // one week
  }

	return !p.deleted;
}
