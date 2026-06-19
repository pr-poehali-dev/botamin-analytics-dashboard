import Icon from '@/components/ui/icon';

export default function SectionTitle({ icon, title }: { icon: string; title: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: 'var(--brand-green-muted)', border: '1px solid rgba(0,255,136,0.2)' }}>
        <Icon name={icon} size={15} style={{ color: 'var(--brand-green)' }} />
      </div>
      <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{title}</h2>
    </div>
  );
}
