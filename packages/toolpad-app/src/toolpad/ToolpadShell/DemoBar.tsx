import * as React from 'react';
import { Box, Button, Link, styled, SxProps, Typography } from '@mui/material';
import KeyboardArrowRightRounded from '@mui/icons-material/KeyboardArrowRightRounded';
import { blueDark, grey } from '../../theme';
import { DOCUMENTATION_INSTALLATION_URL, ROADMAP_URL, SCHEDULE_DEMO_URL } from '../../constants';

const DemoBarContainer = styled(Box)({
  alignItems: 'center',
  backgroundColor: blueDark[50],
  color: grey[700],
  display: 'flex',
  height: 60,
  justifyContent: 'space-between',
  paddingLeft: 20,
  paddingRight: 20,
});

export default function DemoBar() {
  const linkStyles: SxProps = {
    color: grey[700],
    fontWeight: 'normal',
    textDecorationColor: grey[700],
    '&:hover': { color: grey[700] },
  };

  return (
    <DemoBarContainer>
      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
        Demo version
      </Typography>
      <Typography variant="body2" textAlign="center">
        Check out our{' '}
        <Link href={ROADMAP_URL} target="_blank" underline="always" sx={linkStyles}>
          roadmap
        </Link>{' '}
        to stay up to date, or{' '}
        <Link href={SCHEDULE_DEMO_URL} target="_blank" underline="always" sx={linkStyles}>
          schedule a demo
        </Link>
        .<br />
        Note: PostgreSQL, Google Sheets are supported in the self-hosted version.
      </Typography>
      <Link href={DOCUMENTATION_INSTALLATION_URL} target="_blank">
        <Button size="medium" variant="contained" endIcon={<KeyboardArrowRightRounded />}>
          Self-host
        </Button>
      </Link>
    </DemoBarContainer>
  );
}
