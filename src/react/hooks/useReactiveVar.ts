import { useState, useEffect, useLayoutEffect } from 'react';
import { ReactiveVar } from '../../core';

export function useReactiveVar<T>(rv: ReactiveVar<T>): T {
  const value = rv();
  // We don't actually care what useState thinks the value of the variable
  // is, so we take only the update function from the returned array.
  const [, setValue] = useState(value);
  // We subscribe to variable updates on initial mount and when the value has
  // changed. This avoids a subtle bug in React.StrictMode where multiple listeners
  // are added, leading to inconsistent updates.
  useLayoutEffect(() => rv.onNextChange(setValue), [value]);
  // Once the component is unmounted, ignore future updates. Note that the
  // above useEffect function returns a mute function without calling it,
  // allowing it to be called when the component unmounts. This is
  // equivalent to the following, but shorter:
  // useEffect(() => {
  //   const mute = rv.onNextChange(setValue);
  //   return () => mute();
  // }, [value])

  // We check the variable's value in this useEffect and schedule an update if
  // the value has changed. This check occurs once, on the initial render, to avoid
  // a useEffect higher in the component tree changing a variable's value
  // before the above useEffect can set the onNextChange handler. Note that React
  // will not schedule an update if setState is called with the same value as before.
  useEffect(() => setValue(rv()), []);

  return value;
}
