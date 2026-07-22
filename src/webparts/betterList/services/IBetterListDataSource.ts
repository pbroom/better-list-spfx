import {
  IBetterListFieldInfo,
  IBetterListListInfo,
  IBetterListListReference,
  IBetterListLoadRequest,
  IBetterListLoadResult
} from '../../../shared';

export interface IBetterListDataSource {
  discoverLists(): Promise<readonly IBetterListListInfo[]>;
  resolveListUrl(value: string): Promise<IBetterListListInfo>;
  discoverFields(list: IBetterListListReference): Promise<readonly IBetterListFieldInfo[]>;
  loadItems(request: IBetterListLoadRequest): Promise<IBetterListLoadResult>;
}
