// Mock rxjs Subject & Observables
interface Subscription {
  readonly unsubscribe: () => void;
}
interface Observable<T> {
  readonly subscribe: (fn: (value: any) => void) => Subscription;
}

class Subject<T = any> {
  private observers = new Set<(value: T) => void>();
  private subscriptions = new Set<Subscription>();
  asObservable(): Observable<T> {
    return {
      subscribe: (fn: any) => {
        this.observers.add(fn);
        const subscription: Subscription = {
          unsubscribe: () => {
            this.observers.delete(fn);
            this.subscriptions.delete(subscription);
          },
        };
        this.subscriptions.add(subscription);
        return subscription;
      },
    };
  }

  next(value) {
    this.observers.forEach((fn) => fn(value));
  }

  complete() {
    this.subscriptions.forEach((observer) => observer.unsubscribe());
  }
}

function createModel(clazz, instance) {
  clazz.prototype._changes = {};

  clazz.prototype.isModified = function () {
    return Object.keys(this._changes).length > 0;
  };
  clazz.prototype.changes = function () {
    return this._changes;
  };

  const changes = new Subject();
  clazz.prototype.changes$ = changes.asObservable();

  const propertiesProxyHandler = {
    set(target, prop, value) {
      if (!['_changes'].includes(prop)) {
        target[prop] = value;
        target._changes = {
          ...target._changes,
          [prop]: value,
        };
        changes.next(target._changes);
      }
      return true;
    },
    get(target, prop, receiver) {
      return target[prop];
    },
  };
  return new Proxy(instance, propertiesProxyHandler);
}

function Model<T extends { new (...args: any[]): {} }>(
  clazz: T
): T & IModel<T> {
  return class extends clazz {
    constructor(...args: any[]) {
      super(...args) as any;
      return createModel(clazz, this);
    }
  } as T & IModel<T>;
}

interface IModel<T> {
  new (...args: any[]): T & IModel<T>;
  isModified: () => boolean;
  changes: () => { [K in keyof T]: T[K] };
  changes$: Observable<{ [K in keyof T]: T[K] }>;
}

@Model
class Person {
  public firstName: string;
  public lastName: string;
  constructor(person: Person) {
    this.firstName = person.firstName;
    this.lastName = person.lastName;
  }
}

@Model
class User extends Person {
  constructor(person: Person, public email: string) {
    super(person);
  }
}
// needed for Typing
const UserModel = User as IModel<User>;
const PersonModel = Person as IModel<Person>;

const peter = new PersonModel({ firstName: 'Peter', lastName: 'Schmidt' });
const jhon = new UserModel(
  { firstName: 'Jhon', lastName: 'Doe' },
  'jhon@doe.com'
);

function check(model) {
  console.log('false expected:', model.isModified());
  model.firstName = 'awesome';
  console.log('true expected:', model.isModified());
}

check(peter);
// extends do not work yet
check(jhon);
