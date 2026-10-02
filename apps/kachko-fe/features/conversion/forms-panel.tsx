"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreatorForm, FormField, FormFieldType } from "@kachko/types";
import { useEditor } from "../editor/use-editor";
import { addField, createTemplateForm, deleteField, deleteForm, listForms, reorderFields, updateField, updateForm } from "./api";

const fieldTypes: FormFieldType[] = ["TEXT", "EMAIL", "PHONE", "TEXTAREA", "SELECT", "CHECKBOX"];

export function FormsPanel() {
  const editor = useEditor();
  const page = editor.page!;
  const qc = useQueryClient();
  const key = ["forms", page.id];
  const forms = useQuery({ queryKey: key, queryFn: () => listForms(page.id) });
  const refresh = () => qc.invalidateQueries({ queryKey: key });
  const create = useMutation({ mutationFn: (kind: "FORM" | "SUBSCRIBE") => createTemplateForm(page.id, kind), onSuccess: refresh });
  const remove = useMutation({ mutationFn: deleteForm, onSuccess: refresh });
  return <section>
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-[26px] font-extrabold tracking-[-1px]">Forms</h1><p className="mt-1 text-sm text-[var(--k-muted)]">Build contact and subscription forms used by your page blocks.</p></div><div className="flex gap-2"><button className="k-btn-line" disabled={create.isPending} onClick={() => create.mutate("SUBSCRIBE")}>New signup form</button><button className="k-btn-ink" disabled={create.isPending} onClick={() => create.mutate("FORM")}>{create.isPending ? "Creating…" : "New contact form"}</button></div></div>
    {forms.isLoading ? <div className="k-panel p-10 text-center text-sm text-[var(--k-muted)]">Loading forms…</div> : forms.isError ? <div role="alert" className="k-panel p-6 text-red-700">Could not load forms. <button className="underline" onClick={() => forms.refetch()}>Try again</button></div> : !forms.data?.length ? <div className="k-panel p-10 text-center"><p className="font-extrabold">No forms yet</p><p className="mt-1 text-sm text-[var(--k-muted)]">Create a contact form or add one from the block library.</p></div> : <div className="grid gap-5">{forms.data.map(form => <FormEditor key={form.id} form={form} onChange={refresh} onDelete={() => remove.mutate(form.id)} busy={remove.isPending} />)}</div>}
    {(create.error || remove.error) ? <p role="alert" className="mt-4 text-sm text-red-700">{(create.error ?? remove.error)?.message}</p> : null}
  </section>;
}

function FormEditor({ form, onChange, onDelete, busy }: { form: CreatorForm; onChange: () => void; onDelete: () => void; busy: boolean }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(form.title ?? "");
  const [description, setDescription] = useState(form.description ?? "");
  const [submitLabel, setSubmitLabel] = useState(form.submitLabel);
  const [successType, setSuccessType] = useState<"MESSAGE" | "REDIRECT">(form.successType);
  const [successValue, setSuccessValue] = useState(form.successType === "REDIRECT" ? form.successConfig?.url ?? "" : form.successConfig?.message ?? "Thanks — your response was received.");
  const [fieldType, setFieldType] = useState<FormFieldType>("TEXT");
  const [fieldLabel, setFieldLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const run = async (operation: () => Promise<unknown>) => { setError(null); try { await operation(); onChange(); } catch (value) { setError(value instanceof Error ? value.message : "Could not save form"); } };
  const sorted = [...form.fields].sort((a, b) => a.position - b.position);
  return <article className="k-panel overflow-hidden"><button type="button" className="flex w-full items-center justify-between gap-4 p-5 text-left" onClick={() => setOpen(value => !value)}><span><span className="block font-extrabold">{form.name}</span><span className="mt-1 block text-xs text-[var(--k-muted)]">{form.fields.length} fields · {form.isActive ? "Active" : "Paused"}</span></span><span className="text-xl">{open ? "−" : "+"}</span></button>{open ? <div className="border-t border-[#eceee9] p-5"><div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-bold">Title<input className="k-input mt-1" value={title} onChange={event => setTitle(event.target.value)} /></label><label className="text-xs font-bold">Button label<input className="k-input mt-1" value={submitLabel} onChange={event => setSubmitLabel(event.target.value)} /></label><label className="text-xs font-bold sm:col-span-2">Description<textarea className="k-input mt-1 min-h-20" value={description} onChange={event => setDescription(event.target.value)} /></label><label className="text-xs font-bold">After submit<select className="k-input mt-1" value={successType} onChange={event => setSuccessType(event.target.value as "MESSAGE" | "REDIRECT")}><option value="MESSAGE">Show message</option><option value="REDIRECT">Open URL</option></select></label><label className="text-xs font-bold">{successType === "REDIRECT" ? "Redirect URL" : "Success message"}<input className="k-input mt-1" type={successType === "REDIRECT" ? "url" : "text"} value={successValue} onChange={event => setSuccessValue(event.target.value)} /></label></div><div className="mt-3 flex flex-wrap gap-2"><button className="k-btn-ink !h-9" onClick={() => void run(() => updateForm(form.id, { title: title || null, description: description || null, submitLabel, successType, successConfig: successType === "REDIRECT" ? { url: successValue } : { message: successValue } }))}>Save details</button><button className="k-btn-line !h-9" onClick={() => void run(() => updateForm(form.id, { isActive: !form.isActive }))}>{form.isActive ? "Pause form" : "Activate form"}</button><button className="ml-auto text-xs font-bold text-red-700" disabled={busy} onClick={onDelete}>Delete form</button></div>
      <div className="mt-6"><p className="k-label">Fields</p><div className="grid gap-2">{sorted.map((field, index) => <EditableField key={field.id} field={field} index={index} count={sorted.length} onMove={direction => run(() => reorderFields(form.id, move(sorted.map(item => item.id), index, index + direction)))} onUpdate={input => run(() => updateField(form.id, field.id, input))} onDelete={() => run(() => deleteField(form.id, field.id))} />)}</div>
        <div className="mt-3 grid gap-2 sm:grid-cols-[auto_1fr_auto]"><select className="k-input !w-auto" value={fieldType} onChange={event => setFieldType(event.target.value as FormFieldType)}>{fieldTypes.map(type => <option key={type}>{type}</option>)}</select><input className="k-input" placeholder="Field label" value={fieldLabel} onChange={event => setFieldLabel(event.target.value)} /><button className="k-btn-ink" disabled={!fieldLabel.trim()} onClick={() => { const label = fieldLabel.trim(); const name = `${label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")}_${Date.now().toString().slice(-4)}`; void run(() => addField(form.id, { type: fieldType, label, name, ...(fieldType === "SELECT" ? { config: { options: ["Option 1", "Option 2"] } } : {}) })).then(() => setFieldLabel("")); }}>Add field</button></div>
      </div>{error ? <p role="alert" className="mt-3 text-sm text-red-700">{error}</p> : null}</div> : null}</article>;
}

function EditableField({ field, index, count, onMove, onUpdate, onDelete }: { field: FormField; index: number; count: number; onMove: (direction: -1 | 1) => Promise<void>; onUpdate: (input: Parameters<typeof updateField>[2]) => Promise<void>; onDelete: () => Promise<void> }) {
  const [label, setLabel] = useState(field.label); const [placeholder, setPlaceholder] = useState(field.placeholder ?? "");
  const [options, setOptions] = useState(field.config?.options?.join(", ") ?? "");
  return <details className="rounded-xl border border-[#eceee9] bg-white p-3"><summary className="flex cursor-pointer list-none flex-wrap items-center gap-2"><span className="min-w-0 flex-1"><span className="block text-sm font-extrabold">{field.label}{field.required ? " *" : ""}</span><span className="text-[10px] text-[var(--k-muted)]">{field.type} · {field.name}</span></span><button type="button" className="k-btn-line !h-8 !px-2" disabled={index === 0} onClick={event => { event.preventDefault(); void onMove(-1); }}>↑</button><button type="button" className="k-btn-line !h-8 !px-2" disabled={index === count - 1} onClick={event => { event.preventDefault(); void onMove(1); }}>↓</button><span className="text-xs font-bold text-[#718c1b]">Edit</span></summary><div className="mt-3 grid gap-2 sm:grid-cols-2"><label className="text-xs font-bold">Label<input className="k-input mt-1" value={label} onChange={event => setLabel(event.target.value)} /></label><label className="text-xs font-bold">Placeholder<input className="k-input mt-1" value={placeholder} onChange={event => setPlaceholder(event.target.value)} /></label>{field.type === "SELECT" ? <label className="text-xs font-bold sm:col-span-2">Options, comma separated<input className="k-input mt-1" value={options} onChange={event => setOptions(event.target.value)} /></label> : null}</div><div className="mt-3 flex flex-wrap gap-2"><button type="button" className="k-btn-ink !h-8" disabled={!label.trim()} onClick={() => void onUpdate({ label: label.trim(), placeholder: placeholder.trim() || null, ...(field.type === "SELECT" ? { config: { options: options.split(",").map(value => value.trim()).filter(Boolean) } } : {}) })}>Save field</button><button type="button" className="k-btn-line !h-8" onClick={() => void onUpdate({ required: !field.required })}>{field.required ? "Make optional" : "Make required"}</button><button type="button" className="ml-auto text-xs font-bold text-red-700" onClick={() => void onDelete()}>Delete</button></div></details>;
}

function move<T>(items: T[], from: number, to: number) { const next = [...items]; const [item] = next.splice(from, 1); if (item !== undefined) next.splice(to, 0, item); return next; }
