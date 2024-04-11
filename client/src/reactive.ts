export default class Reactive<T> {
  #data: T | undefined;
  #element?: Element;
  #name: string;
  #template: (props: T) => string;

  constructor(name: string, data: T | undefined, template: (props: T) => string) {
    this.#name = name;
    this.#data = data
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

  set(data: T) {
    if (!data) {
      return false;
    }

    this.#data = data;
    this.render();
    return true;
  }

  render() {
    if (!this.#data) {
      return;
    }

    this.#getElement().innerHTML = this.#template(this.#data);
  }

  create() {
    return `<div class="${this.#name}"></div>`;
  }
}
