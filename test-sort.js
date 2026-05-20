const items = [
  { id: '1', parentId: null, val: 5 },
  { id: '1a', parentId: '1', val: 7 },
  { id: '3', parentId: null, val: 2 },
  { id: '1b', parentId: '1', val: 1 },
  { id: '2', parentId: null, val: 9 },
  { id: '2a', parentId: '2', val: 8 },
];

const childrenByParent = new Map();
items.forEach(item => {
  if (item.parentId) {
    if (!childrenByParent.has(item.parentId)) {
      childrenByParent.set(item.parentId, []);
    }
    childrenByParent.get(item.parentId).push(item);
  }
});

// we could just sort everything as normal first
items.sort((a,b) => a.val - b.val);

// Then group
const grouped = [];
const visited = new Set();
for (const item of items) {
  // if this is a top-level item (or its parent isn't in the current sorted list?)
  // Actually, what if its parent is in the list?
  // Let's assume parentId is definitely in the DB if it has one.
  const isTopLevel = !item.parentId;
  if (isTopLevel && !visited.has(item.id)) {
    grouped.push(item);
    visited.add(item.id);
    // add children
    const addChildren = (parentId) => {
      const children = childrenByParent.get(parentId) || [];
      // respect the same sort for children
      children.sort((a,b) => a.val - b.val);
      for (const child of children) {
        if (!visited.has(child.id)) {
          grouped.push(child);
          visited.add(child.id);
          addChildren(child.id);
        }
      }
    };
    addChildren(item.id);
  }
}
console.log(grouped.map(i => i.id));
