export interface ResolveFn<T> {
  (result: T);
}

export interface RejectFn {
  (error: any);
}

export class Deferred<T> {
  promise: Promise<T>;
  resolve: ResolveFn<T>;
  reject: RejectFn;

  static create(Promise?) {
    new Deferred(Promise);
  }

  constructor(Promise?) {
    if (Promise == null) {
      Promise = global.Promise;
    }

    this.promise = new Promise((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject
    });
  }

}

export function defer(Promise?) {
  return new Deferred(Promise);
}
