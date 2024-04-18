export default class Reactive<T> {
  #data: Partial<T>;
  #element?: Element;
  #name: string;
  #template: (props: Partial<T>, set?: ((data: Partial<T>) => void) | undefined) => string;
  #rendering: boolean = false;

  constructor(name: string, data: T | null, template: (props: Partial<T>, set?: ((data: Partial<T>) => void) | undefined) => string) {
    this.#name = name;
    if (data === null) {
      this.#data = {};
    } else {
      this.#data = data;
    }
    this.#template = template;
  }

  #getElement(): Element {
    if (this.#element) {
      return this.#element;
    }

    const element = document.querySelector(`.${this.#name}`);
    if (!element) {
      throw Error("element not found");
    }
    return element;
  }

  get() {
    return this.#data;
  }

  set(data: Partial<T>) {
    if (!data) {
      return false;
    }

    if (typeof data === 'object') {
      this.#data = {...this.#data, ...data};
    } else {
      this.#data = data;
    }

    if (!this.#rendering) {
      this.#rendering = true;
      this.render();
      this.#rendering = false;
    }
    return true;
  }

  render() {
    if (!this.#data) {
      return;
    }

    // todo: rerenders from calling set should not call set again
    this.#getElement().innerHTML = this.#template(this.#data, this.set.bind(this));
  }

  create() {
    return `<div class="${this.#name}"></div>`;
  }
}
