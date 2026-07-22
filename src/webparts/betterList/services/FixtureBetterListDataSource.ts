import {
  IBetterListAudienceIdentity,
  IBetterListFieldInfo,
  IBetterListItem,
  IBetterListListInfo,
  IBetterListListReference,
  IBetterListLoadRequest,
  IBetterListLoadResult,
  filterVisibleItems,
  normalizeItem
} from '../../../shared';
import { IBetterListDataSource } from './IBetterListDataSource';

export interface IBetterListFixtureOptions {
  identity?: IBetterListAudienceIdentity;
  lists?: readonly IBetterListListInfo[];
  fields?: readonly IBetterListFieldInfo[];
}

export class FixtureBetterListDataSource implements IBetterListDataSource {
  private readonly _records: readonly Readonly<Record<string, unknown>>[];
  private readonly _identity: IBetterListAudienceIdentity;
  private readonly _lists: readonly IBetterListListInfo[];
  private readonly _fields: readonly IBetterListFieldInfo[];

  public constructor(
    records: readonly Readonly<Record<string, unknown>>[],
    options: IBetterListFixtureOptions = {}
  ) {
    this._records = records;
    this._identity = options.identity || { groupIds: [] };
    this._lists = options.lists || [{ id: 'fixture', title: 'Fixture data', itemCount: records.length, baseTemplate: 100 }];
    this._fields = options.fields || [];
  }

  public discoverLists(): Promise<readonly IBetterListListInfo[]> {
    return Promise.resolve(this._lists);
  }

  public resolveListUrl(value: string): Promise<IBetterListListInfo> {
    const normalized: string = value.trim().replace(/[?#].*$/, '').replace(/\/$/, '').toLocaleLowerCase();
    const match: IBetterListListInfo | undefined = this._lists.find((list) =>
      Boolean(list.serverRelativeUrl && normalized.endsWith(list.serverRelativeUrl.toLocaleLowerCase()))
    );
    return match
      ? Promise.resolve(match)
      : Promise.reject(new Error('The fixture does not contain a list for that SharePoint URL.'));
  }

  public discoverFields(_list: IBetterListListReference): Promise<readonly IBetterListFieldInfo[]> {
    return Promise.resolve(this._fields);
  }

  public loadItems(request: IBetterListLoadRequest): Promise<IBetterListLoadResult> {
    const items: readonly IBetterListItem[] = this._records.map((record: Readonly<Record<string, unknown>>) =>
      normalizeItem(record, request.mappings)
    );
    return Promise.resolve({
      items: filterVisibleItems(items, this._identity),
      audienceIdentity: this._identity
    });
  }
}
