// AceCoatingsROICalculator.js

import React, { useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip as ChartTooltip,
  Legend,
  LineController,
  BarController,
  ScatterController,
  Filler
} from 'chart.js';
import { Chart } from 'react-chartjs-2';
import {
  Typography,
  Container,
  Paper,
  Slider,
  Grid,
  Card,
  CardHeader,
  CardContent,
  Box,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField
} from '@mui/material';
import { createTheme, ThemeProvider } from '@mui/material/styles';

// ----------------- Chart.js Registrations ----------------- //
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  BarController,
  LineController,
  ScatterController,
  Title,
  ChartTooltip,
  Legend,
  Filler
);

// Helper functions for backlog logic, interpolation, etc.
function interpolateRevenue(cumulativeData, fraction) {
  const i = Math.floor(fraction);
  const d = fraction - i;
  if (fraction <= 0) return cumulativeData[0];
  if (fraction >= cumulativeData.length - 1) return cumulativeData[cumulativeData.length - 1];
  const start = cumulativeData[i];
  const end = cumulativeData[i + 1];
  return start + d * (end - start);
}

function computeBacklogArray({
  months,
  dailyAdSpend,
  netRevenuePerJob,
  closeRate,
  crewCount,
  baseJobsPerWeek,
}) {
  const backlogArray = [];
  let backlog = 0;
  for (let i = 0; i < months; i++) {
    const dailyLeads = dailyAdSpend / 36;
    const monthlyLeads = dailyLeads * 30;
    const monthlyBookings = monthlyLeads * closeRate;
    const monthlyCapacity = (baseJobsPerWeek * crewCount) * 4.3;
    backlog += (monthlyBookings - monthlyCapacity);
    if (backlog < 0) backlog = 0;
    backlogArray.push(backlog);
  }
  return backlogArray;
}

function findThresholdFraction(backlogArray, thresholdJobs) {
  if (thresholdJobs <= backlogArray[0]) {
    return 0;
  }
  for (let i = 1; i < backlogArray.length; i++) {
    if (backlogArray[i] >= thresholdJobs) {
      const prev = backlogArray[i - 1];
      const curr = backlogArray[i];
      const fraction = (thresholdJobs - prev) / (curr - prev);
      return (i - 1) + fraction;
    }
  }
  return backlogArray.length - 1;
}

// Ace config
const aceConfig = {
  title: "Ace Coatings ROI Calculator",
  jobSize: 1800,
  costPerSqft: 3.75,
  laborCostPerHour: 48,
  jobHours: 21,
  materialsCost: 1526,
  marketingCost: 180,
  baseJobsPerWeek: 2.5,
  equipmentCost: 4800,
  licenseFee: 10000,
};

const totalStartupCost = aceConfig.equipmentCost + aceConfig.licenseFee;

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#2196F3' },
    secondary: { main: '#FF9800' },
    text: { primary: '#0D47A1' },
    background: { default: '#f5f5f5', paper: '#ffffff' },
  },
  typography: { fontFamily: "'Roboto', sans-serif", h4: { fontWeight: 700 } },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 4,
          boxShadow: '0px 2px 8px rgba(0,0,0,0.15)',
          overflow: 'hidden',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: { borderRadius: 4 },
      },
    },
  },
});

const sliderSx = {
  color: '#2196F3',
  '& .MuiSlider-thumb': {
    backgroundColor: '#BBDEFB',
    border: '2px solid #2196F3',
  },
  '& .MuiSlider-track': { color: '#2196F3' },
  '& .MuiSlider-rail': { color: '#b0b0b0' },
};

const adSpendMapping = {
  Aggressive: 75,
  Moderate: 50,
  Conservative: 30,
};

export default function AceCoatingsROICalculator() {
  const [timeFrame, setTimeFrame] = useState(6);
  const [crewCount, setCrewCount] = useState(1);
  const [adSpendOption, setAdSpendOption] = useState("Moderate");
  const [showTargets, setShowTargets] = useState(true);

  const [aggression, setAggression] = useState('Coming Soon');
  const [zipCode, setZipCode] = useState('');

  // Basic calcs
  const grossRevenuePerJob = aceConfig.jobSize * aceConfig.costPerSqft;
  const laborCostPerJob = aceConfig.jobHours * aceConfig.laborCostPerHour;
  const netRevenuePerJob = grossRevenuePerJob - (laborCostPerJob + aceConfig.materialsCost + aceConfig.marketingCost);

  const effectiveJobsPerWeek = aceConfig.baseJobsPerWeek * crewCount;
  const jobsPerMonth = effectiveJobsPerWeek * 4.3;

  const dailyAdSpend = adSpendMapping[adSpendOption];
  const monthlyAdSpend = dailyAdSpend * 30;

  const monthlyNetRevenue = netRevenuePerJob * jobsPerMonth - monthlyAdSpend;

  const adjustedMonthlyRevenue = (() => {
    const firstMonth = monthlyNetRevenue - totalStartupCost;
    return [firstMonth, ...Array(timeFrame - 1).fill(monthlyNetRevenue)];
  })();

  let cumSum = 0;
  const cumulativeRevenue = adjustedMonthlyRevenue.map((val) => {
    cumSum += val;
    return cumSum;
  });

  const mrrData = Array.from({ length: timeFrame }, () => monthlyNetRevenue + totalStartupCost);

  const weeklyNetRevenue = netRevenuePerJob * effectiveJobsPerWeek;
  const rawBreakEvenWeeks = totalStartupCost / (weeklyNetRevenue || 1);
  const breakEvenDisplay = Math.ceil(rawBreakEvenWeeks) + " weeks";

  // backlog approach
  const backlogArray = computeBacklogArray({
    months: timeFrame,
    dailyAdSpend,
    netRevenuePerJob,
    closeRate: 0.5,
    crewCount,
    baseJobsPerWeek: aceConfig.baseJobsPerWeek,
  });

  // thresholds in weeks
  const baseJobsPerWeek_crew = aceConfig.baseJobsPerWeek * crewCount;
  function thresholdJobs(weeks) {
    return weeks * baseJobsPerWeek_crew;
  }
  const thresholds = [
    { weeks: 4, color: 'red', label: 'Aggressive (4 wks)' },
    { weeks: 8, color: 'yellow', label: 'Moderate (8 wks)' },
    { weeks: 10, color: 'green', label: 'Conservative (10 wks)' },
  ];

  let bookingTargets = [];
  if (showTargets) {
    for (let i = 0; i < thresholds.length; i++) {
      const thr = thresholds[i];
      const backlogNeeded = thresholdJobs(thr.weeks);
      const frac = findThresholdFraction(backlogArray, backlogNeeded);
      const y = interpolateRevenue(cumulativeRevenue, frac);
      bookingTargets.push({
        x: frac + 1,
        y,
        color: thr.color,
        label: thr.label,
      });
    }
  }

  const bookingTargetDataset = {
    type: 'scatter',
    label: "Booking Targets",
    data: bookingTargets.map((pt) => ({
      x: pt.x,
      y: pt.y,
      customLabel: pt.label,
    })),
    pointRadius: 8,
    pointBorderColor: '#0D47A1',
    pointBorderWidth: 2,
    pointBackgroundColor: (ctx) => {
      const index = ctx.dataIndex;
      const color = bookingTargets[index].color;
      return color === 'red' ? 'rgba(255,0,0,0.8)'
           : color === 'yellow' ? 'rgba(255,235,59,0.8)'
           : 'rgba(0,255,0,0.8)';
    },
    order: 10000,
  };

  const datasets = [
    {
      type: 'bar',
      label: "Monthly Recurring Revenue ($)",
      data: mrrData,
      backgroundColor: 'rgba(255, 152, 0, 0.7)',
      order: 1,
    },
    {
      type: 'line',
      label: "Cumulative Revenue ($)",
      data: cumulativeRevenue,
      borderColor: '#0D47A1',
      borderWidth: 4,
      fill: false,
      order: 9999,
      drawTime: 'afterDatasetsDraw',
      z: 9999,
    },
  ];
  if (showTargets) {
    datasets.push(bookingTargetDataset);
  }

  const chartData = {
    labels: Array.from({ length: timeFrame }, (_, i) => `Month ${i + 1}`),
    datasets,
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      tooltip: {
        callbacks: {
          label: (ctx) => {
            if (ctx.dataset.label === "Booking Targets") {
              const index = ctx.dataIndex;
              const customLabel = ctx.dataset.data[index].customLabel;
              return customLabel || "Booking threshold";
            }
            // fallback
            return `${ctx.parsed.y.toLocaleString()} dollars`;
          }
        }
      }
    },
    scales: {
      x: {
        stacked: false,
        barPercentage: 0.5,
        categoryPercentage: 0.5,
        ticks: { color: '#0D47A1' },
      },
      y: {
        stacked: false,
        ticks: { color: '#0D47A1', callback: (value) => `$${value.toLocaleString()}` },
      },
    },
  };

  const monthlyJobsDisplay = jobsPerMonth.toFixed(1);
  const netRevenuePerJobDisplay = netRevenuePerJob.toFixed(2);
  const monthlyNetRevenueDisplay = (netRevenuePerJob * jobsPerMonth).toFixed(2);

  return (
    <ThemeProvider theme={theme}>
      <Container maxWidth="xl" sx={{ py: 4, backgroundColor: '#f5f5f5', minHeight: '100vh' }}>
        <Paper sx={{ p: 4 }}>
          <Typography variant="h4" align="center" gutterBottom>
            {aceConfig.title}
          </Typography>

          {/* placeholders row */}
          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={12} sm={4}>
              <FormControl fullWidth disabled>
                <InputLabel>Aggression Setting</InputLabel>
                <Select value={aggression} label="Aggression Setting">
                  <MenuItem value="Aggressive">Aggressive (2-4 weeks booked)</MenuItem>
                  <MenuItem value="Medium">Medium (6-8 weeks booked)</MenuItem>
                  <MenuItem value="Conservative">Conservative (10+ weeks booked)</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label="Zip Code (for seasonal adjustments)"
                value={zipCode}
                disabled
                helperText="Coming soon"
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <FormControl fullWidth>
                <InputLabel>Daily Ad Spend</InputLabel>
                <Select
                  value={adSpendOption}
                  label="Daily Ad Spend"
                  onChange={(e) => setAdSpendOption(e.target.value)}
                >
                  <MenuItem value="Aggressive">Aggressive ($75/day)</MenuItem>
                  <MenuItem value="Moderate">Moderate ($50/day)</MenuItem>
                  <MenuItem value="Conservative">Conservative ($30/day)</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>

          {/* Toggle for booking targets */}
          <Box sx={{ textAlign: 'right', mb: 2 }}>
            <Button variant="outlined" onClick={() => setShowTargets(!showTargets)}>
              {showTargets ? "Hide Booking Targets" : "Show Booking Targets"}
            </Button>
          </Box>

          {/* Crew Count */}
          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={12} sm={6}>
              <Typography>Number of Crews: {crewCount}</Typography>
              <Slider
                sx={sliderSx}
                value={crewCount}
                onChange={(e, val) => setCrewCount(val)}
                min={1}
                max={3}
                step={1}
                valueLabelDisplay="auto"
              />
            </Grid>
          </Grid>

          {/* Time Frame */}
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <Typography>Time Frame (months): {timeFrame}</Typography>
              <Slider
                sx={sliderSx}
                value={timeFrame}
                onChange={(e, val) => setTimeFrame(val)}
                min={3}
                max={24}
                step={1}
                valueLabelDisplay="auto"
              />
            </Grid>
          </Grid>

          {/* Chart */}
          <Box sx={{ height: 500, mt: 4, width: '100%' }}>
            <Chart type="bar" data={chartData} options={chartOptions} />
          </Box>

          {/* Data Cards */}
          <Grid container spacing={2} sx={{ mt: 4 }}>
            <Grid item xs={12} sm={3}>
              <Card>
                <CardHeader title="Gross Revenue per Job" sx={{ backgroundColor: '#BBDEFB', py: 1 }} />
                <CardContent>
                  <Typography>${grossRevenuePerJob.toFixed(2)}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={3}>
              <Card>
                <CardHeader title="Net Revenue per Job" sx={{ backgroundColor: '#BBDEFB', py: 1 }} />
                <CardContent>
                  <Typography>${netRevenuePerJobDisplay}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={3}>
              <Card>
                <CardHeader title="Monthly Net Revenue" sx={{ backgroundColor: '#BBDEFB', py: 1 }} />
                <CardContent>
                  <Typography>${monthlyNetRevenueDisplay}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={3}>
              <Card>
                <CardHeader title="Break-Even" sx={{ backgroundColor: '#BBDEFB', py: 1 }} />
                <CardContent>
                  <Typography>
                    {Math.ceil(totalStartupCost / (netRevenuePerJob * effectiveJobsPerWeek || 1))} weeks
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* CTA */}
          <Box sx={{ mt: 4, textAlign: 'center' }}>
            <Button variant="contained" sx={{ mr: 2 }} onClick={() => {
              if (crewCount < 3) {
                setCrewCount(crewCount + 1);
                alert(`Crew added! Now using ${crewCount + 1} crew(s).`);
              } else {
                alert("Maximum crews reached.");
              }
            }}>
              Add Crew
            </Button>
            <Button variant="outlined" onClick={() => alert("Email projections functionality coming soon!")}>
              Email Me My Projections
            </Button>
          </Box>
        </Paper>
      </Container>
    </ThemeProvider>
  );
}
