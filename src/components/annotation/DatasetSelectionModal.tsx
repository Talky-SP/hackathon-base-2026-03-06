import { useState, useEffect } from 'react';
import { Loader2, Plus, Database } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import Modal from '../ui/Modal';
import { Button } from '../ui';
import { fetchDatasets, createDataset, type Dataset } from '../../services/annotationService';

// ─── Component ──────────────────────────────────────────────────────────────

interface DatasetSelectionModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (datasetId: string) => void;
}

export default function DatasetSelectionModal({ open, onClose, onConfirm }: DatasetSelectionModalProps) {
  const { t } = useLanguage();
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newDatasetName, setNewDatasetName] = useState('');
  const [newDatasetDescription, setNewDatasetDescription] = useState('');
  const [creating, setCreating] = useState(false);

  // Fetch datasets when modal opens
  useEffect(() => {
    if (open) {
      loadDatasets();
    }
  }, [open]);

  const loadDatasets = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchDatasets();
      setDatasets(data);
      if (data.length > 0 && !selectedDatasetId) {
        setSelectedDatasetId(data[0].datasetId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load datasets');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDataset = async () => {
    if (!newDatasetName.trim()) {
      setError('Dataset name is required');
      return;
    }

    setCreating(true);
    setError('');
    try {
      const datasetId = await createDataset(
        newDatasetName.trim(),
        newDatasetDescription.trim() || undefined
      );
      await loadDatasets();
      setSelectedDatasetId(datasetId);
      setShowCreateForm(false);
      setNewDatasetName('');
      setNewDatasetDescription('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create dataset');
    } finally {
      setCreating(false);
    }
  };

  const handleConfirm = () => {
    if (selectedDatasetId) {
      onConfirm(selectedDatasetId);
    }
  };

  const handleClose = () => {
    setShowCreateForm(false);
    setNewDatasetName('');
    setNewDatasetDescription('');
    setError('');
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={t('annotation.dataset.selectTitle')}
      maxWidth="max-w-md"
      footer={
        <>
          <Button variant="ghost" size="md" onClick={handleClose}>
            {t('annotation.dataset.cancel')}
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={handleConfirm}
            disabled={!selectedDatasetId || loading || creating}
          >
            {t('annotation.dataset.confirm')}
          </Button>
        </>
      }
    >
      <div className="px-5 py-4 space-y-4">
        {/* Loading state */}
        {loading && (
          <div className="flex items-center justify-center py-8 text-gray-500">
            <Loader2 size={20} className="animate-spin mr-2" />
            <span className="text-sm">{t('annotation.dataset.loading')}</span>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="bg-red-100 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-xs">
            {error}
          </div>
        )}

        {/* Dataset selection */}
        {!loading && !showCreateForm && (
          <>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">
                {t('annotation.dataset.selectLabel')}
              </label>
              <select
                value={selectedDatasetId}
                onChange={(e) => setSelectedDatasetId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none"
              >
                {datasets.length === 0 && (
                  <option value="">{t('annotation.dataset.noDatasets')}</option>
                )}
                {datasets.map((dataset) => (
                  <option key={dataset.datasetId} value={dataset.datasetId}>
                    {dataset.name} ({dataset.documentCount} {t('annotation.dataset.documents')})
                  </option>
                ))}
              </select>
            </div>

            {/* Dataset info */}
            {selectedDatasetId && datasets.length > 0 && (
              <div className="bg-gray-100 rounded-lg p-3 space-y-1 text-xs text-gray-500">
                {(() => {
                  const dataset = datasets.find((d) => d.datasetId === selectedDatasetId);
                  if (!dataset) return null;
                  return (
                    <>
                      <div className="flex items-center gap-1.5">
                        <Database size={12} className="text-gray-500" />
                        <span className="font-medium text-gray-800">{dataset.name}</span>
                      </div>
                      {dataset.description && (
                        <div className="text-gray-500">{dataset.description}</div>
                      )}
                      <div className="flex gap-3 pt-1">
                        <span>
                          {t('annotation.dataset.documents')}: <strong className="text-gray-800">{dataset.documentCount}</strong>
                        </span>
                        {dataset.documentTypes && (
                          <span>
                            {t('annotation.dataset.types')}:{' '}
                            <strong className="text-gray-800">
                              {Object.keys(dataset.documentTypes).join(', ')}
                            </strong>
                          </span>
                        )}
                      </div>
                    </>
                  );
                })()}
              </div>
            )}

            {/* Create new dataset button */}
            <button
              onClick={() => setShowCreateForm(true)}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-brand-700 border border-brand-200 rounded-lg hover:bg-brand-100/50 transition-colors"
            >
              <Plus size={14} />
              {t('annotation.dataset.createNew')}
            </button>
          </>
        )}

        {/* Create dataset form */}
        {!loading && showCreateForm && (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">
                {t('annotation.dataset.nameLabel')}
              </label>
              <input
                type="text"
                value={newDatasetName}
                onChange={(e) => setNewDatasetName(e.target.value)}
                placeholder={t('annotation.dataset.namePlaceholder')}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none"
                disabled={creating}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">
                {t('annotation.dataset.descriptionLabel')} ({t('annotation.dataset.optional')})
              </label>
              <textarea
                value={newDatasetDescription}
                onChange={(e) => setNewDatasetDescription(e.target.value)}
                placeholder={t('annotation.dataset.descriptionPlaceholder')}
                rows={3}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none resize-none"
                disabled={creating}
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowCreateForm(false);
                  setNewDatasetName('');
                  setNewDatasetDescription('');
                  setError('');
                }}
                disabled={creating}
                fullWidth
              >
                {t('annotation.dataset.back')}
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleCreateDataset}
                disabled={creating || !newDatasetName.trim()}
                icon={creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                fullWidth
              >
                {t('annotation.dataset.create')}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
