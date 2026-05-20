
import { Trip } from '../models/trip.model';
import { nanoid } from 'nanoid';

export const slugGenerator = {
    async generate(label: string): Promise<string> {
        const base = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 20).replace(/-$/, '');
        let slug = `${base}-${nanoid(6)}`;
        let tries = 0;
        while (await Trip.exists({ slug }) && tries < 5) {
            slug = `${base}-${nanoid(6)}`; tries++;
        }
        return slug;
    },
};
