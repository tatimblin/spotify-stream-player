interface Options<T> {
  handler?: (callback: () => void) => ProxyHandler<T extends object>;
}

type ProxyKeys<Keys extends string> = { [K in Keys]: K };

type ProxyKey<T> = keyof T & (string | symbol);

var handler = function<T>(callback: () => void): ProxyHandler<T> {
	return {
		get: function (obj: T, prop: ProxyKeys<T>): any {
			if (['[object Object]', '[object Array]'].indexOf(Object.prototype.toString.call(obj[prop])) > -1) {
				return new Proxy(obj[prop]!, handler(callback));
			}
			return obj[prop];
			callback();
		},
		set: function (obj: T, prop: ProxyKeys<T>, value: T[ProxyKeys<T>]) {
			obj[prop] = value;
			callback();
			return true;
		},
		deleteProperty: function (obj: T, prop: ProxyKeys<T>) {
			delete obj[prop];
			callback();
			return true;

		}
	};
};

export default class Reactive<T> {
  #element: Element;
  #data: typeof Proxy | undefined;
  #template: (props: T) => string;
  #options: Options<T>;

  constructor(selector: string, data: T | undefined, template: (props: T) => string, options: Options<T> = {}) {
    this.#options = options;

    const element = document.querySelector(selector);
    if (!element) {
      throw Error("element not found");
    }
    this.#element = element;

    if (data) {
      this.#data = new Proxy(data, this.#options.handler(this.render.bind(this)));
    }

    this.#template = template;
  }

  get() {
    return this.#data;
  }

  set(data: T) {
    if (!data) {
      return false;
    }

    this.#data = new Proxy(data, this.#options.handler(this.render.bind(this)));
    this.render();
    return true;
  }

  render() {
    if (!this.#data) {
      return;
    }

    this.#element.innerHTML = this.#template(this.#data);
  }

  #proxyHandler(): ProxyHandler<T extends object> {
    return {
      get<K extends keyof T>(obj: T, prop: K): T[K] | Proxy<T[K]> {
        if (['[object Object]', '[object Array]'].indexOf(Object.prototype.toString.call(obj[prop])) > -1) {
          return new Proxy<T[K]>(obj[prop], this.#proxyHandler<T>());
        }
        return obj[prop];
      },
      set: (obj: T, prop: keyof T, value: T[keyof T]) => {
        obj[prop] = value;
        this.render();
        return true;
      },
      deleteProperty: (obj: T, prop: keyof T) => {
        delete obj[prop];
        this.render();
        return true;
      }
    };
  }
}
