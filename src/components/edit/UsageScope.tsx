/**
 * Scope hint for the selected element: where its component is used across the
 * project. Editing a shared component changes it everywhere it renders, so this
 * surfaces the blast radius — a one-line summary, and a modal listing every
 * render site (pages / layouts / components).
 */

import { useState } from 'react';
import { ModalFrame } from '../primitives/ModalFrame';
import { type UsageReport, type UsageSite, type FileKind } from '../../lib/edit';

const KIND_LABEL: Record<FileKind, string> = {
  layout: 'Layouts',
  page: 'Pages',
  component: 'Components',
};

/** Collapse render sites to one entry per file, with all its line numbers. */
function groupByFile(sites: UsageSite[]): { file: string; lines: number[] }[] {
  const map = new Map<string, number[]>();
  for (const s of sites) {
    const lines = map.get(s.file);
    if (lines) lines.push(s.line);
    else map.set(s.file, [s.line]);
  }
  return [...map.entries()].map(([file, lines]) => ({ file, lines }));
}

function Section({ kind, sites }: { kind: FileKind; sites: UsageSite[] }) {
  if (sites.length === 0) return null;
  const files = groupByFile(sites);
  return (
    <section className="ss-usage-sec">
      <header className="ss-usage-sec__head">
        <span className={`ss-usage-sec__dot ss-usage-sec__dot--${kind}`} aria-hidden />
        <span className="ss-usage-sec__label">{KIND_LABEL[kind]}</span>
        <span className="ss-usage-sec__count">
          {files.length} {files.length === 1 ? 'file' : 'files'}
        </span>
      </header>
      <ul className="ss-usage-sec__list">
        {files.map(({ file, lines }) => {
          const base = file.split('/').pop() ?? file;
          const dir = file.slice(0, file.length - base.length);
          return (
            <li key={file} className="ss-usage-row" title={file}>
              <span className="ss-usage-row__path">
                <span className="ss-usage-row__dir">{dir}</span>
                <span className="ss-usage-row__name">{base}</span>
              </span>
              <span className="ss-usage-row__lines">
                {lines.map((l) => (
                  <span key={l} className="ss-usage-row__line" title={`line ${l}`}>
                    {l}
                  </span>
                ))}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

interface Props {
  usage: UsageReport | null;
  /** Live DOM instances on the current page (from the selection). */
  instanceCount: number;
}

export function UsageScope({ usage, instanceCount }: Props) {
  const [open, setOpen] = useState(false);
  if (!usage) return null;

  // Editing a route page → scoped to that page. Editing a layout → every page.
  if (usage.selfKind === 'page') {
    return <p className="ss-edit-panel__scope">Only on this page.</p>;
  }
  if (usage.selfKind === 'layout') {
    return (
      <p className="ss-edit-panel__scope ss-edit-panel__scope--wide">
        In a layout — this applies to <strong>every page</strong>.
      </p>
    );
  }

  // A reusable component: surface where it renders.
  const { sites, component } = usage;
  const name = component ?? 'this component';
  if (sites.length === 0) {
    return <p className="ss-edit-panel__scope">Part of the {name} component.</p>;
  }
  const inLayout = sites.some((s) => s.kind === 'layout');

  return (
    <>
      <button
        type="button"
        className={`ss-edit-panel__scope ss-edit-panel__scope--btn${
          inLayout ? ' ss-edit-panel__scope--wide' : ''
        }`}
        onClick={() => setOpen(true)}
      >
        {inLayout ? (
          <>
            Used in a layout — appears on <strong>every page</strong>.
          </>
        ) : (
          <>
            {instanceCount} on this page · used in {sites.length}{' '}
            {sites.length === 1 ? 'place' : 'places'}
          </>
        )}
        <span className="ss-edit-panel__scope-more"> View all →</span>
      </button>

      <ModalFrame
        isOpen={open}
        onClose={() => setOpen(false)}
        title={
          <>
            Where <code className="ss-usage-modal__name">{name}</code> is used
          </>
        }
        className="ss-usage-modal"
      >
        <div className="ss-usage-modal__body">
          <p className="ss-usage-modal__note">
            Editing this element updates it in <strong>{sites.length} places</strong> across your
            project.
          </p>
          <div className="ss-usage-modal__scroll">
            <Section kind="layout" sites={sites.filter((s) => s.kind === 'layout')} />
            <Section kind="page" sites={sites.filter((s) => s.kind === 'page')} />
            <Section kind="component" sites={sites.filter((s) => s.kind === 'component')} />
          </div>
        </div>
      </ModalFrame>
    </>
  );
}
