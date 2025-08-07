package player

import "time"

type Fingerprint struct {
	uuid            string
	epoch           time.Time
	expectedEndTime time.Time
}

type FingerprintInterface interface {
	IsZero() bool
}

func (psf *Fingerprint) IsZero() bool {
	return psf.epoch.IsZero() && psf.uuid == ""
}
