function decorateProp<T extends object, K extends keyof T>(
  obj: T,
  propKey: K,
  decorator: (oldPropVal: T[K]) => T[K],
) {
  const oldPropVal = obj[propKey];
  const propVal = decorator(oldPropVal);
  obj[propKey] = propVal;
}

export default decorateProp;
