const classNameCollator = new Intl.Collator('ru', {
  numeric: true,
  sensitivity: 'base',
});

/** Sorts class labels in their natural order: 1, 2, …, 10, 11. */
export function sortClassesNaturally<T extends { name: string }>(classes: T[]) {
  return [...classes].sort((firstClass, secondClass) => (
    classNameCollator.compare(firstClass.name, secondClass.name)
  ));
}
