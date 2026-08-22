import { useCallback, useEffect, useState } from 'react';
import { useCommand } from '../components/GlobalLayout.jsx';
import { useToast } from '../components/LiquidToast.jsx';
import { TICKET_CATEGORIES } from '../../js/domain.js';
import { isAdmin } from '../lib/access.js';
import { createTicket, fetchPersonnelRoster, fetchTickets, updateTicket, deleteTicket } from '../lib/services.js';
import { PageHeader, StatusBadge, btnDanger, btnPrimary, fieldClass, glassClass, CommandSelect } from '../lib/ui.jsx';

export default function Tickets() {
  const { supabase, t, lang, session, activePersonnel, formatPersonnelName } = useCommand();
  const toast = useToast();
  const guest = !session;
  const admin = isAdmin(activePersonnel);
  const [tickets, setTickets] = useState([]);
  const [roster, setRoster] = useState([]);
  const [category, setCategory] = useState('forgot_password');
  const [topic, setTopic] = useState('');
  const [body, setBody] = useState('');
  const [email, setEmail] = useState('');
  const [replies, setReplies] = useState({});
  const options = guest ? TICKET_CATEGORIES.filter((item) => item.id === 'forgot_password') : TICKET_CATEGORIES;

  const load = useCallback(async () => {
    if (guest) {
      setTickets([]);
      return;
    }
    const rows = await fetchTickets(supabase, admin, activePersonnel?.id);
    setTickets(rows);
    const map = {};
    rows.forEach((row) => {
      map[row.id] = { admin_reply: row.admin_reply || '', status: row.status || 'open' };
    });
    setReplies(map);
    if (admin) {
      setRoster(await fetchPersonnelRoster(supabase).catch(() => []));
    }
  }, [activePersonnel, admin, guest, supabase]);

  useEffect(() => {
    load().catch((error) => toast.alert(error.message));
  }, [load, toast]);

  function categoryLabel(id) {
    const row = TICKET_CATEGORIES.find((item) => item.id === id);
    if (!row) {
      return id;
    }
    return lang === 'th' ? row.th : row.en;
  }

  function submitterName(ticket) {
    if (ticket.contact_email) {
      return ticket.contact_email;
    }
    const person = roster.find((row) => row.id === ticket.user_id);
    return person ? formatPersonnelName(person) || ticket.user_id : ticket.user_id || t('units.unnamed');
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!topic.trim() || !body.trim() || (guest && !email.trim())) {
      toast.alert(t('tickets.invalid'));
      return;
    }
    try {
      await createTicket(supabase, {
        userId: activePersonnel?.id || null,
        category: guest ? 'forgot_password' : category,
        customTopic: topic.trim(),
        body: body.trim(),
        contactEmail: guest ? email.trim() : null
      });
      setTopic('');
      setBody('');
      setEmail('');
      toast.success(t('tickets.sent'));
      await load();
    } catch (error) {
      toast.alert(error.message);
    }
  }

  async function handleDelete(ticket) {
    if (!window.confirm(t('tickets.confirmDelete'))) {
      return;
    }
    try {
      await deleteTicket(supabase, ticket.id);
      toast.success(t('tickets.deleted'));
      await load();
    } catch (error) {
      toast.alert(error.message);
    }
  }

  return (
    <section className="mx-auto max-w-3xl">
      <PageHeader kicker={t('tickets.kicker')} title={t('tickets.title')} lead={t('tickets.lead')} />
      {guest ? <p className="mb-4 text-sm text-amber-700 dark:text-amber-200">{t('tickets.guestOnlyForgot')}</p> : null}
      <form className={`${glassClass} mb-8 grid gap-3 p-5`} onSubmit={handleSubmit}>
        <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
          {t('tickets.category')}
          <CommandSelect
            required
            value={category}
            onChange={setCategory}
            options={options.map((item) => ({ value: item.id, label: categoryLabel(item.id) }))}
          />
        </label>
        {guest ? (
          <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
            {t('tickets.email')}
            <input className={fieldClass} type="email" required maxLength={120} value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
        ) : null}
        <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
          {t('tickets.topic')}
          <input className={fieldClass} required maxLength={120} value={topic} onChange={(event) => setTopic(event.target.value)} />
        </label>
        <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
          {t('tickets.body')}
          <textarea className={`${fieldClass} min-h-28 py-3`} rows={5} required value={body} onChange={(event) => setBody(event.target.value)} />
        </label>
        <button type="submit" className={btnPrimary}>
          {t('tickets.submit')}
        </button>
      </form>

      <section>
        <h2 className="mb-3 text-lg font-semibold">{t('tickets.listTitle')}</h2>
        {tickets.length ? (
          <div className="grid gap-3">
            {tickets.map((ticket) => (
              <article key={ticket.id} className={`${glassClass} p-4`}>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h3 className="font-semibold">{ticket.custom_topic || categoryLabel(ticket.category)}</h3>
                  <div className="flex items-center gap-2">
                    <StatusBadge tone={ticket.status === 'closed' ? 'closed' : ticket.status === 'in_progress' ? 'planning' : 'open'}>
                      {t(`tickets.status.${ticket.status || 'open'}`)}
                    </StatusBadge>
                    {admin || ticket.user_id === activePersonnel?.id ? (
                      <button type="button" className={`${btnDanger} !min-h-9 px-3 text-xs`} onClick={() => handleDelete(ticket)}>
                        {t('tickets.delete')}
                      </button>
                    ) : null}
                  </div>
                </div>
                <p className="text-sm text-slate-500">
                  {categoryLabel(ticket.category)}
                  {admin ? ` · ${submitterName(ticket)}` : ''}
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm">{ticket.body}</p>
                {admin ? (
                  <div className="mt-3 grid gap-2">
                    <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                      {t('tickets.reply')}
                      <textarea
                        className={`${fieldClass} min-h-20 py-3`}
                        rows={3}
                        value={replies[ticket.id]?.admin_reply || ''}
                        onChange={(event) => setReplies((current) => ({ ...current, [ticket.id]: { ...current[ticket.id], admin_reply: event.target.value } }))}
                      />
                    </label>
                    <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                      {t('tickets.statusLabel')}
                      <CommandSelect
                        value={replies[ticket.id]?.status || 'open'}
                        onChange={(value) => setReplies((current) => ({ ...current, [ticket.id]: { ...current[ticket.id], status: value } }))}
                        options={[
                          { value: 'open', label: t('tickets.status.open') },
                          { value: 'in_progress', label: t('tickets.status.in_progress') },
                          { value: 'closed', label: t('tickets.status.closed') }
                        ]}
                      />
                    </label>
                    <button
                      type="button"
                      className={btnPrimary}
                      onClick={async () => {
                        await updateTicket(supabase, ticket.id, replies[ticket.id]);
                        toast.success(t('tickets.updated'));
                        await load();
                      }}
                    >
                      {t('common.save')}
                    </button>
                  </div>
                ) : ticket.admin_reply ? (
                  <p className="mt-3 text-sm">
                    <strong>{t('tickets.reply')}:</strong> {ticket.admin_reply}
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">{t('tickets.empty')}</p>
        )}
      </section>
    </section>
  );
}
