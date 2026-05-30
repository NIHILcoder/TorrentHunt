/**
 * Search Page
 * Plugin-based torrent search using Jackett/Torznab/Custom providers.
 */

import React, { useState, useCallback } from 'react';
import { SearchResult, SearchProvider } from '../../shared/types';
import { Button, Icon, Input, EmptyState } from '../components';
import './SearchPage.css';

const formatBytes = (bytes: number): string => {
  if (!bytes || bytes === 0) return '—';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const CATEGORIES = [
  { value: '', label: 'All Categories' },
  { value: '2000', label: 'Movies' },
  { value: '5000', label: 'TV' },
  { value: '3000', label: 'Music' },
  { value: '4000', label: 'PC/Software' },
  { value: '6000', label: 'XXX' },
  { value: '8000', label: 'Other' },
];

const SearchPage: React.FC = () => {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [downloading, setDownloading] = useState<Set<number>>(new Set());
  const [addedIndices, setAddedIndices] = useState<Set<number>>(new Set());

  // Providers tab state
  const [showProviders, setShowProviders] = useState(false);
  const [providers, setProviders] = useState<SearchProvider[]>([]);
  const [newProvider, setNewProvider] = useState({
    name: '', url: '', apiKey: '', type: 'jackett' as 'jackett' | 'torznab' | 'custom', enabled: true
  });
  const [savingProvider, setSavingProvider] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; success: boolean; message: string } | null>(null);

  const loadProviders = useCallback(async () => {
    try {
      const list = await window.api.search.getProviders();
      setProviders(list);
    } catch (err) {
      console.error('Failed to load providers:', err);
    }
  }, []);

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError(null);
    setHasSearched(true);
    setResults([]);

    try {
      const res = await window.api.search.query(query.trim(), category || undefined);
      setResults(res);
    } catch (err: any) {
      setError(err?.message || 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (result: SearchResult, idx: number) => {
    if (downloading.has(idx)) return;
    setDownloading(prev => new Set(prev).add(idx));

    try {
      const uri = result.magnetUri || result.torrentUrl;
      if (!uri) throw new Error('No downloadable link');

      await window.api.addDownload({
        sourceType: result.magnetUri ? 'magnet' : 'torrent_file',
        sourceUri: uri,
        name: result.title,
      });

      setAddedIndices(prev => new Set(prev).add(idx));
    } catch (err: any) {
      alert(`Failed to add: ${err?.message || err}`);
    } finally {
      setDownloading(prev => {
        const next = new Set(prev);
        next.delete(idx);
        return next;
      });
    }
  };

  const handleAddProvider = async () => {
    if (!newProvider.name || !newProvider.url) return;
    setSavingProvider(true);
    try {
      await window.api.search.addProvider(newProvider);
      setNewProvider({ name: '', url: '', apiKey: '', type: 'jackett', enabled: true });
      await loadProviders();
    } catch (err: any) {
      alert(`Failed to add provider: ${err?.message}`);
    } finally {
      setSavingProvider(false);
    }
  };

  const handleDeleteProvider = async (id: string) => {
    if (!confirm('Remove this provider?')) return;
    try {
      await window.api.search.removeProvider(id);
      await loadProviders();
    } catch (err: any) {
      alert(`Failed: ${err?.message}`);
    }
  };

  const handleToggleProvider = async (id: string, enabled: boolean) => {
    try {
      await window.api.search.updateProvider(id, { enabled });
      await loadProviders();
    } catch (err: any) {
      alert(`Failed: ${err?.message}`);
    }
  };

  const handleTestProvider = async (id: string) => {
    setTestingId(id);
    setTestResult(null);
    try {
      const result = await window.api.search.testProvider(id);
      setTestResult({ id, ...result });
    } catch (err: any) {
      setTestResult({ id, success: false, message: err?.message || 'Test failed' });
    } finally {
      setTestingId(null);
    }
  };

  return (
    <div className="search-page">
      <div className="page-header">
        <h1 className="page-title">
          <Icon name="search" size={22} />
          Search Torrents
        </h1>
        <button
          className={`tab-btn ${showProviders ? 'active' : ''}`}
          onClick={() => { setShowProviders(!showProviders); if (!showProviders) loadProviders(); }}
        >
          <Icon name="settings" size={16} />
          Providers
        </button>
      </div>

      {!showProviders ? (
        <div className="page-content">
          {/* Search form */}
          <form className="search-form" onSubmit={handleSearch}>
            <div className="search-input-row">
              <div className="search-input-wrap">
                <Icon name="search" size={18} className="search-icon-inside" />
                <input
                  type="text"
                  className="search-input"
                  placeholder="Search for torrents..."
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  autoFocus
                />
              </div>
              <select
                className="search-category"
                value={category}
                onChange={e => setCategory(e.target.value)}
              >
                {CATEGORIES.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
              <Button
                variant="primary"
                type="submit"
                loading={loading}
                disabled={loading || !query.trim()}
                icon={<Icon name="search" size={16} />}
              >
                Search
              </Button>
            </div>
          </form>

          {/* Error */}
          {error && (
            <div className="search-error">
              <Icon name="alert-circle" size={16} />
              {error}
            </div>
          )}

          {/* No providers hint */}
          {!loading && !hasSearched && (
            <div className="search-hint">
              <Icon name="info" size={40} />
              <h3>Configure a search provider first</h3>
              <p>
                TorrentHunt uses a plugin-based search system. Add a{' '}
                <strong>Jackett</strong>, <strong>Prowlarr</strong>, or custom provider
                to start searching.
              </p>
              <Button
                variant="primary"
                onClick={() => { setShowProviders(true); loadProviders(); }}
                icon={<Icon name="settings" size={16} />}
              >
                Open Provider Settings
              </Button>
            </div>
          )}

          {/* Results */}
          {hasSearched && !loading && results.length === 0 && !error && (
            <EmptyState icon="search" title="No results" description="Try a different query or check your providers." />
          )}

          {results.length > 0 && (
            <div className="search-results">
              <div className="search-results-header">
                <span className="results-count">{results.length} results</span>
              </div>
              <div className="results-table">
                <div className="results-thead">
                  <div className="results-th name-col">Name</div>
                  <div className="results-th size-col">Size</div>
                  <div className="results-th seeds-col">S/L</div>
                  <div className="results-th provider-col">Provider</div>
                  <div className="results-th action-col"></div>
                </div>
                {results.map((r, idx) => (
                  <div
                    key={`${r.infoHash || r.title}-${idx}`}
                    className={`results-row ${addedIndices.has(idx) ? 'added' : ''}`}
                  >
                    <div className="results-td name-col">
                      <span className="result-title" title={r.title}>{r.title}</span>
                      {r.category && <span className="result-category">{r.category}</span>}
                    </div>
                    <div className="results-td size-col">{formatBytes(r.size)}</div>
                    <div className="results-td seeds-col">
                      <span className="seeds">{r.seeds}</span>
                      <span className="sep">/</span>
                      <span className="leechers">{r.leechers}</span>
                    </div>
                    <div className="results-td provider-col">
                      <span className="provider-badge">{r.provider}</span>
                    </div>
                    <div className="results-td action-col">
                      {addedIndices.has(idx) ? (
                        <span className="added-badge">
                          <Icon name="check" size={14} /> Added
                        </span>
                      ) : (
                        <Button
                          variant="primary"
                          size="sm"
                          loading={downloading.has(idx)}
                          disabled={downloading.has(idx) || (!r.magnetUri && !r.torrentUrl)}
                          onClick={() => handleDownload(r, idx)}
                          icon={<Icon name="download" size={14} />}
                        >
                          Download
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Providers settings panel */
        <div className="page-content providers-panel">
          <div className="providers-section">
            <h2>Search Providers</h2>
            <p className="providers-desc">
              Add Jackett, Prowlarr (Torznab), or custom JSON API providers.
              Jackett & Prowlarr are self-hosted — enter your local URL + API key.
            </p>

            {/* Provider list */}
            {providers.length === 0 ? (
              <div className="providers-empty">No providers configured yet.</div>
            ) : (
              <div className="providers-list">
                {providers.map(p => (
                  <div key={p.id} className={`provider-card ${!p.enabled ? 'disabled' : ''}`}>
                    <div className="provider-info">
                      <div className="provider-name">{p.name}</div>
                      <div className="provider-url">{p.url}</div>
                      <span className={`provider-type-badge ${p.type}`}>{p.type}</span>
                    </div>
                    {testResult?.id === p.id && (
                      <div className={`test-result ${testResult.success ? 'success' : 'error'}`}>
                        <Icon name={testResult.success ? 'check-circle' : 'x-circle'} size={14} />
                        {testResult.message}
                      </div>
                    )}
                    <div className="provider-actions">
                      <button
                        className={`toggle-btn ${p.enabled ? 'on' : 'off'}`}
                        onClick={() => handleToggleProvider(p.id, !p.enabled)}
                        title={p.enabled ? 'Disable' : 'Enable'}
                      >
                        <Icon name={p.enabled ? 'eye' : 'eye-off'} size={14} />
                      </button>
                      <Button
                        variant="ghost"
                        size="sm"
                        loading={testingId === p.id}
                        onClick={() => handleTestProvider(p.id)}
                        icon={<Icon name="zap" size={14} />}
                      >
                        Test
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteProvider(p.id)}
                        icon={<Icon name="trash" size={14} />}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Add new provider */}
            <div className="add-provider-form">
              <h3>Add Provider</h3>
              <div className="form-row">
                <input
                  type="text"
                  className="form-input"
                  placeholder="Provider name"
                  value={newProvider.name}
                  onChange={e => setNewProvider(p => ({ ...p, name: e.target.value }))}
                />
                <select
                  className="form-select"
                  value={newProvider.type}
                  onChange={e => setNewProvider(p => ({ ...p, type: e.target.value as any }))}
                >
                  <option value="jackett">Jackett</option>
                  <option value="torznab">Torznab (Prowlarr)</option>
                  <option value="custom">Custom JSON</option>
                </select>
              </div>
              <div className="form-row">
                <input
                  type="url"
                  className="form-input"
                  placeholder={
                    newProvider.type === 'jackett'
                      ? 'http://localhost:9117'
                      : newProvider.type === 'torznab'
                      ? 'http://localhost:9696'
                      : 'https://api.example.com/search?q={query}'
                  }
                  value={newProvider.url}
                  onChange={e => setNewProvider(p => ({ ...p, url: e.target.value }))}
                />
                <input
                  type="text"
                  className="form-input api-key-input"
                  placeholder="API Key (optional)"
                  value={newProvider.apiKey}
                  onChange={e => setNewProvider(p => ({ ...p, apiKey: e.target.value }))}
                />
              </div>
              <Button
                variant="primary"
                loading={savingProvider}
                disabled={!newProvider.name || !newProvider.url}
                onClick={handleAddProvider}
                icon={<Icon name="plus" size={16} />}
              >
                Add Provider
              </Button>
            </div>

            {/* Help box */}
            <div className="provider-help">
              <h4><Icon name="help-circle" size={16} /> Setup Guide</h4>
              <ul>
                <li><strong>Jackett:</strong> Download from <code>github.com/Jackett/Jackett</code>, start it, then add <code>http://localhost:9117</code> with your API key from the Jackett dashboard.</li>
                <li><strong>Prowlarr:</strong> Use Torznab type, URL <code>http://localhost:9696</code>, API key from Prowlarr Settings → Security.</li>
                <li><strong>Custom:</strong> Any JSON API that accepts <code>?q={`{query}`}</code> and returns <code>{"{ results: [{title, magnetUri, size, seeds, leechers}] }"}</code>.</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchPage;
