'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { Restaurant, MenuCategory, MenuItem } from '@/lib/types';

export default function MenuEditorClient({
  restaurant,
  initialCategories,
  initialItems
}: {
  restaurant: Restaurant;
  initialCategories: MenuCategory[];
  initialItems: MenuItem[];
}) {
  const [categories, setCategories] = useState(initialCategories);
  const [items, setItems] = useState(initialItems);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [showNewItem, setShowNewItem] = useState(false);
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  async function toggleAvailable(item: MenuItem) {
    setBusy(true);
    const res = await fetch(`/api/menu-items/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isAvailable: !item.is_available })
    });
    setBusy(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      showToast('Failed: ' + (err.error ?? 'unknown'));
      return;
    }
    const updated = await res.json();
    setItems(items.map(i => (i.id === item.id ? updated : i)));
    showToast(updated.is_available ? 'Item available' : 'Item hidden');
  }

  async function deleteItem(item: MenuItem) {
    if (!confirm(`Delete "${item.name}"? This cannot be undone.`)) return;
    setBusy(true);
    const res = await fetch(`/api/menu-items/${item.id}`, { method: 'DELETE' });
    setBusy(false);
    if (!res.ok) {
      showToast('Delete failed');
      return;
    }
    setItems(items.filter(i => i.id !== item.id));
    showToast('Item deleted');
  }

  async function saveItem(form: ItemForm, isNew: boolean, existingId?: string) {
    setBusy(true);
    let res: Response;
    if (isNew) {
      res = await fetch('/api/menu-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurantId: restaurant.id,
          categoryId: form.categoryId || null,
          name: form.name,
          description: form.description,
          price: form.price,
          isVeg: form.isVeg,
          isChefPick: form.isChefPick
        })
      });
    } else {
      res = await fetch(`/api/menu-items/${existingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categoryId: form.categoryId || null,
          name: form.name,
          description: form.description,
          price: form.price,
          isVeg: form.isVeg,
          isChefPick: form.isChefPick
        })
      });
    }
    setBusy(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      showToast('Save failed: ' + (err.error ?? 'unknown'));
      return;
    }
    const data = await res.json();
    if (isNew) {
      setItems([...items, data]);
      setShowNewItem(false);
      showToast('Item added');
    } else {
      setItems(items.map(i => (i.id === existingId ? data : i)));
      setEditingItem(null);
      showToast('Item updated');
    }
  }

  async function addCategory(name: string) {
    setBusy(true);
    const res = await fetch('/api/menu-categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ restaurantId: restaurant.id, name })
    });
    setBusy(false);
    if (!res.ok) {
      showToast('Failed to add category');
      return;
    }
    const data = await res.json();
    setCategories([...categories, data]);
    setShowNewCategory(false);
    showToast('Category added');
  }

  return (
    <main className="min-h-screen p-6 max-w-5xl mx-auto">
      <header className="flex justify-between items-start mb-6 flex-wrap gap-3">
        <div>
          <Link href="/admin" className="text-xs text-charcoal/60">← All restaurants</Link>
          <h1 className="font-serif text-3xl mt-1">{restaurant.name} · Menu</h1>
          <p className="text-sm text-charcoal/60 mt-1">Add, edit, and manage your menu items.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowNewCategory(true)}
            className="px-3 py-2 text-sm border border-charcoal/20 rounded hover:bg-charcoal/5"
          >
            + Category
          </button>
          <button
            onClick={() => setShowNewItem(true)}
            className="px-4 py-2 bg-forest text-white rounded text-sm hover:bg-forest/90"
          >
            + Add item
          </button>
        </div>
      </header>

      {/* Categories with their items */}
      <div className="space-y-6">
        {categories.map(cat => {
          const catItems = items.filter(i => i.category_id === cat.id);
          return (
            <div key={cat.id}>
              <div className="text-xs tracking-widest text-charcoal/50 mb-2">
                {cat.name.toUpperCase()} <span className="text-charcoal/30">· {catItems.length}</span>
              </div>
              <div className="border border-charcoal/10 rounded-lg overflow-hidden bg-white">
                {catItems.length === 0 && (
                  <div className="px-4 py-6 text-center text-sm text-charcoal/40">No items in this category yet</div>
                )}
                {catItems.map(it => (
                  <div key={it.id} className="px-4 py-3 border-b border-charcoal/10 last:border-b-0 flex justify-between items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`font-medium text-sm ${!it.is_available ? 'text-charcoal/40 line-through' : ''}`}>{it.name}</span>
                        {it.is_chef_pick && <span className="text-[9px] bg-cream text-forest px-1.5 py-0.5 rounded">CHEF</span>}
                        {it.is_veg && <span className="text-[9px] border border-green-700 text-green-700 px-1.5 py-0.5 rounded">VEG</span>}
                        {!it.is_available && <span className="text-[9px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">HIDDEN</span>}
                      </div>
                      {it.description && (
                        <div className={`text-xs mt-0.5 ${!it.is_available ? 'text-charcoal/30' : 'text-charcoal/60'}`}>{it.description}</div>
                      )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-sm font-medium">₹{it.price}</span>
                      <button
                        onClick={() => toggleAvailable(it)}
                        disabled={busy}
                        className="text-xs px-2 py-1 border border-charcoal/20 rounded hover:bg-charcoal/5"
                        title={it.is_available ? 'Hide from menu' : 'Show on menu'}
                      >
                        {it.is_available ? 'Hide' : 'Show'}
                      </button>
                      <button
                        onClick={() => setEditingItem(it)}
                        className="text-xs px-2 py-1 border border-charcoal/20 rounded hover:bg-charcoal/5"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteItem(it)}
                        disabled={busy}
                        className="text-xs px-2 py-1 text-red-700 border border-red-200 rounded hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {categories.length === 0 && (
          <div className="text-center py-12 text-charcoal/50 text-sm border border-dashed border-charcoal/20 rounded-lg">
            No categories yet. Click <strong>+ Category</strong> to add one.
          </div>
        )}
      </div>

      {/* New Item Modal */}
      {showNewItem && (
        <ItemFormModal
          title="Add menu item"
          categories={categories}
          onCancel={() => setShowNewItem(false)}
          onSave={form => saveItem(form, true)}
          busy={busy}
        />
      )}

      {/* Edit Item Modal */}
      {editingItem && (
        <ItemFormModal
          title="Edit menu item"
          categories={categories}
          initial={editingItem}
          onCancel={() => setEditingItem(null)}
          onSave={form => saveItem(form, false, editingItem.id)}
          busy={busy}
        />
      )}

      {/* New Category Modal */}
      {showNewCategory && (
        <CategoryFormModal
          onCancel={() => setShowNewCategory(false)}
          onSave={addCategory}
          busy={busy}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-charcoal text-white px-4 py-2 rounded-md text-sm shadow-lg">
          {toast}
        </div>
      )}
    </main>
  );
}

interface ItemForm {
  name: string;
  description: string;
  price: number;
  categoryId: string;
  isVeg: boolean;
  isChefPick: boolean;
}

function ItemFormModal({
  title,
  categories,
  initial,
  onCancel,
  onSave,
  busy
}: {
  title: string;
  categories: MenuCategory[];
  initial?: MenuItem;
  onCancel: () => void;
  onSave: (form: ItemForm) => void;
  busy: boolean;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [price, setPrice] = useState(initial?.price?.toString() ?? '');
  const [categoryId, setCategoryId] = useState(initial?.category_id ?? categories[0]?.id ?? '');
  const [isVeg, setIsVeg] = useState(initial?.is_veg ?? false);
  const [isChefPick, setIsChefPick] = useState(initial?.is_chef_pick ?? false);

  function submit() {
    if (!name.trim() || !price.trim() || isNaN(Number(price))) return;
    onSave({
      name: name.trim(),
      description: description.trim(),
      price: Number(price),
      categoryId,
      isVeg,
      isChefPick
    });
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onCancel}>
      <div className="bg-white rounded-lg w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <h2 className="font-serif text-2xl mb-4">{title}</h2>

        <Field label="Name">
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Burrata with heirloom tomato"
            className="w-full px-3 py-2 border border-charcoal/15 rounded-md text-sm focus:outline-none focus:border-forest"
            autoFocus
          />
        </Field>

        <Field label="Description">
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Pugliese burrata, basil oil, aged balsamic"
            rows={2}
            className="w-full px-3 py-2 border border-charcoal/15 rounded-md text-sm focus:outline-none focus:border-forest resize-none"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Price (₹)">
            <input
              type="number"
              value={price}
              onChange={e => setPrice(e.target.value)}
              placeholder="680"
              className="w-full px-3 py-2 border border-charcoal/15 rounded-md text-sm focus:outline-none focus:border-forest"
            />
          </Field>

          <Field label="Category">
            <select
              value={categoryId}
              onChange={e => setCategoryId(e.target.value)}
              className="w-full px-3 py-2 border border-charcoal/15 rounded-md text-sm focus:outline-none focus:border-forest bg-white"
            >
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
        </div>

        <div className="flex gap-4 mt-4">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={isVeg} onChange={e => setIsVeg(e.target.checked)} className="accent-forest" />
            Vegetarian
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={isChefPick} onChange={e => setIsChefPick(e.target.checked)} className="accent-forest" />
            Chef's pick
          </label>
        </div>

        <div className="flex gap-2 mt-6 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm border border-charcoal/20 rounded hover:bg-charcoal/5"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={busy || !name.trim() || !price.trim()}
            className="px-4 py-2 text-sm bg-forest text-white rounded hover:bg-forest/90 disabled:opacity-50"
          >
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

function CategoryFormModal({
  onCancel,
  onSave,
  busy
}: {
  onCancel: () => void;
  onSave: (name: string) => void;
  busy: boolean;
}) {
  const [name, setName] = useState('');
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onCancel}>
      <div className="bg-white rounded-lg w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
        <h2 className="font-serif text-2xl mb-4">Add category</h2>
        <Field label="Category name">
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Wines, Sides, Specials..."
            className="w-full px-3 py-2 border border-charcoal/15 rounded-md text-sm focus:outline-none focus:border-forest"
            autoFocus
          />
        </Field>
        <div className="flex gap-2 mt-6 justify-end">
          <button onClick={onCancel} className="px-4 py-2 text-sm border border-charcoal/20 rounded hover:bg-charcoal/5">
            Cancel
          </button>
          <button
            onClick={() => name.trim() && onSave(name.trim())}
            disabled={busy || !name.trim()}
            className="px-4 py-2 text-sm bg-forest text-white rounded hover:bg-forest/90 disabled:opacity-50"
          >
            {busy ? 'Saving…' : 'Add'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <label className="block text-xs font-medium text-charcoal/70 mb-1">{label}</label>
      {children}
    </div>
  );
}
