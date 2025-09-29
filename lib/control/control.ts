export interface Control {
  isCanceled: () => boolean,
  statusUpdate: (complete: number, total: number) => void,
}
