import type { McpStdioServer } from '@shared/types';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { useI18n } from '@/i18n';

interface McpServerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  server: McpStdioServer | null;
  onSave: (server: McpStdioServer) => void;
}

export function McpServerDialog({ open, onOpenChange, server, onSave }: McpServerDialogProps) {
  const { t } = useI18n();
  const isEditing = !!server;

  const [formData, setFormData] = React.useState<McpStdioServer>({
    id: '',
    name: '',
    description: '',
    transportType: 'stdio',
    command: '',
    args: [],
    env: {},
    enabled: true,
  });

  React.useEffect(() => {
    if (open) {
      if (server) {
        setFormData(server);
      } else {
        setFormData({
          id: '',
          name: '',
          description: '',
          transportType: 'stdio',
          command: '',
          args: [],
          env: {},
          enabled: true,
        });
      }
    }
  }, [open, server]);

  const handleSubmit = () => {
    if (!formData.id || !formData.command) return;
    onSave(formData);
  };

  const isValid = formData.id && formData.command;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup>
        <DialogHeader>
          <DialogTitle>{isEditing ? t('Edit MCP Server') : t('Add MCP Server')}</DialogTitle>
          <DialogDescription>{t('Configure MCP server connection settings')}</DialogDescription>
        </DialogHeader>

        <DialogPanel className="space-y-4">
          <Field>
            <FieldLabel>{t('ID')} *</FieldLabel>
            <Input
              value={formData.id}
              onChange={(e) => setFormData((f) => ({ ...f, id: e.target.value }))}
              placeholder="mcp-example"
              disabled={isEditing}
            />
          </Field>

          <Field>
            <FieldLabel>{t('Name')}</FieldLabel>
            <Input
              value={formData.name}
              onChange={(e) => setFormData((f) => ({ ...f, name: e.target.value }))}
              placeholder="Example Server"
            />
          </Field>

          <Field>
            <FieldLabel>{t('Command')} *</FieldLabel>
            <Input
              value={formData.command}
              onChange={(e) => setFormData((f) => ({ ...f, command: e.target.value }))}
              placeholder="npx"
            />
          </Field>

          <Field>
            <FieldLabel>{t('Arguments')}</FieldLabel>
            <Input
              value={(formData.args ?? []).join(' ')}
              onChange={(e) =>
                setFormData((f) => ({
                  ...f,
                  args: e.target.value.split(' ').filter(Boolean),
                }))
              }
              placeholder="-y @anthropics/mcp-fetch"
            />
            <p className="text-xs text-muted-foreground mt-1">{t('Space separated')}</p>
          </Field>
        </DialogPanel>

        <DialogFooter variant="bare">
          <DialogClose render={<Button variant="outline">{t('Cancel')}</Button>} />
          <Button onClick={handleSubmit} disabled={!isValid}>
            {t('Save')}
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
