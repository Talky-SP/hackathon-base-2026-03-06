import { useState, useEffect } from 'react';
import { config } from '../config/environment';
import { cachedFetch } from '../services/cachedFetch';

export interface Location {
  locationId: string;
  locationName: string;
  companyCif?: string;
}

interface ApiLocation {
  id: string;
  name: string;
  cif?: string;
  customer_name?: string;
  [key: string]: unknown;
}

function mapApiLocation(loc: ApiLocation): Location {
  return {
    locationId: loc.id,
    locationName: loc.name || loc.customer_name || loc.id,
    companyCif: loc.cif,
  };
}

export function useLocations() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    cachedFetch<{ locations?: ApiLocation[] }>(
      `${config.talkyTpvBaseUrl}/get-user-locations`,
      { ttl: 10 * 60 * 1000 },
    )
      .then(data => {
        if (!cancelled) {
          const locs = (data.locations ?? []).map(mapApiLocation);
          setLocations(locs);
          setError(null);
        }
      })
      .catch(err => {
        if (!cancelled) {
          setError(err.message);
          setLocations([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  return { locations, loading, error };
}
