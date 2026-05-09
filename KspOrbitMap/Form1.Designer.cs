namespace KspOrbitMap;

partial class Form1
{
    private System.ComponentModel.IContainer components = null;

    private TableLayoutPanel mainLayout;
    private FlowLayoutPanel topBar;
    private SplitContainer splitMain;
    private PictureBox orbitMap;
    private Panel manScroll;
    private TableLayoutPanel manPanel;
    private FlowLayoutPanel bottomBar;

    private Button btnConnect;
    private Label lblStatus;
    private ComboBox cmbTarget;
    private Button btnTarget;
    private Label lblShip;
    private Button btnFit;
    private Button btnReset;

    private NumericUpDown nudPro, nudNor, nudRad;
    private Label lblPro, lblNor, lblRad;
    private Button btnProM, btnProP, btnNorM, btnNorP, btnRadM, btnRadP;
    private ComboBox cmbInc;

    private Label lblDV, lblBurn, lblMnuName, lblPePost, lblApPost, lblEnc;
    private NumericUpDown nudTime;

    private Button btnAdd, btnPe, btnAp, btnCirc, btnDel;
    private Label lblBot, lblStatusText;

    protected override void Dispose(bool disposing)
    {
        if (disposing && (components != null)) components.Dispose();
        base.Dispose(disposing);
    }

    private void InitializeComponent()
    {
        mainLayout = new TableLayoutPanel();
        topBar = new FlowLayoutPanel();
        splitMain = new SplitContainer();
        orbitMap = new PictureBox();
        manScroll = new Panel();
        manPanel = new TableLayoutPanel();
        bottomBar = new FlowLayoutPanel();

        btnConnect = new Button(); lblStatus = new Label();
        cmbTarget = new ComboBox(); btnTarget = new Button();
        lblShip = new Label(); btnFit = new Button(); btnReset = new Button();

        nudPro = new NumericUpDown(); nudNor = new NumericUpDown(); nudRad = new NumericUpDown();
        lblPro = new Label(); lblNor = new Label(); lblRad = new Label();
        btnProM = new Button(); btnProP = new Button();
        btnNorM = new Button(); btnNorP = new Button();
        btnRadM = new Button(); btnRadP = new Button();
        cmbInc = new ComboBox();

        lblDV = new Label(); lblBurn = new Label(); lblMnuName = new Label();
        lblPePost = new Label(); lblApPost = new Label(); lblEnc = new Label();
        nudTime = new NumericUpDown();
        btnAdd = new Button(); btnPe = new Button(); btnAp = new Button();
        btnCirc = new Button(); btnDel = new Button(); lblBot = new Label(); lblStatusText = new Label();

        SuspendLayout();

        Text = "KSP Orbital Map";
        Size = new Size(1280, 800);
        MinimumSize = new Size(960, 600);
        Font = new Font("Segoe UI", 9.5f);
        BackColor = Color.FromArgb(30, 30, 30);
        ForeColor = Color.White;

        mainLayout.Dock = DockStyle.Fill;
        mainLayout.ColumnCount = 1;
        mainLayout.RowCount = 3;
        mainLayout.RowStyles.Add(new RowStyle(SizeType.Absolute, 34));
        mainLayout.RowStyles.Add(new RowStyle(SizeType.Percent, 100));
        mainLayout.RowStyles.Add(new RowStyle(SizeType.Absolute, 24));
        mainLayout.Controls.Add(topBar, 0, 0);
        mainLayout.Controls.Add(splitMain, 0, 1);
        mainLayout.Controls.Add(bottomBar, 0, 2);

        // Top bar
        topBar.Dock = DockStyle.Fill;
        topBar.FlowDirection = FlowDirection.LeftToRight;
        topBar.Padding = new Padding(4, 3, 4, 0);
        topBar.BackColor = Color.FromArgb(40, 40, 40);

        btnConnect.Text = "Connect"; btnConnect.Size = new Size(85, 24);
        btnConnect.BackColor = Color.FromArgb(60, 60, 60); btnConnect.ForeColor = Color.White;
        btnConnect.FlatStyle = FlatStyle.Flat; btnConnect.Font = new Font("Segoe UI", 8.5f);
        btnConnect.Click += BtnConnect_Click;

        lblStatus.Text = "● Desconectado"; lblStatus.ForeColor = Color.Red;
        lblStatus.AutoSize = true; lblStatus.TextAlign = ContentAlignment.MiddleLeft;
        lblStatus.Padding = new Padding(4, 0, 4, 0); lblStatus.Font = new Font("Segoe UI", 8.5f);

        cmbTarget.DropDownStyle = ComboBoxStyle.DropDownList; cmbTarget.Size = new Size(140, 22);
        cmbTarget.BackColor = Color.FromArgb(50, 50, 50); cmbTarget.ForeColor = Color.White;
        cmbTarget.FlatStyle = FlatStyle.Flat; cmbTarget.Font = new Font("Segoe UI", 8);

        btnTarget.Text = "Set"; btnTarget.Size = new Size(40, 24);
        btnTarget.BackColor = Color.FromArgb(60, 60, 60); btnTarget.ForeColor = Color.White;
        btnTarget.FlatStyle = FlatStyle.Flat; btnTarget.Font = new Font("Segoe UI", 8.5f);
        btnTarget.Click += BtnSetTarget_Click;

        btnFit.Text = "Fit"; btnFit.Size = new Size(35, 24);
        btnFit.BackColor = Color.FromArgb(50, 70, 50); btnFit.ForeColor = Color.White;
        btnFit.FlatStyle = FlatStyle.Flat; btnFit.Font = new Font("Segoe UI", 8.5f);
        btnFit.Click += BtnFit_Click;

        btnReset.Text = "⟲"; btnReset.Size = new Size(28, 24);
        btnReset.BackColor = Color.FromArgb(60, 60, 60); btnReset.ForeColor = Color.White;
        btnReset.FlatStyle = FlatStyle.Flat; btnReset.Font = new Font("Segoe UI", 8.5f);
        btnReset.Click += BtnResetView_Click;

        lblShip.Text = ""; lblShip.AutoSize = true;
        lblShip.TextAlign = ContentAlignment.MiddleLeft; lblShip.Padding = new Padding(8, 0, 0, 0);
        lblShip.Font = new Font("Segoe UI", 8.5f);

        topBar.Controls.Add(btnConnect); topBar.Controls.Add(lblStatus);
        topBar.Controls.Add(cmbTarget); topBar.Controls.Add(btnTarget);
        topBar.Controls.Add(btnFit); topBar.Controls.Add(btnReset);
        topBar.Controls.Add(lblShip);

        // Split
        splitMain.Dock = DockStyle.Fill; splitMain.Orientation = Orientation.Vertical;
        splitMain.BackColor = Color.FromArgb(30, 30, 30);

        orbitMap.Dock = DockStyle.Fill; orbitMap.BackColor = Color.FromArgb(10, 10, 20);
        orbitMap.Paint += OrbitMap_Paint; orbitMap.MouseDown += OrbitMap_MouseDown;
        orbitMap.MouseMove += OrbitMap_MouseMove; orbitMap.MouseUp += OrbitMap_MouseUp;
        orbitMap.MouseClick += OrbitMap_MouseClick; orbitMap.MouseWheel += OrbitMap_MouseWheel;
        orbitMap.Resize += (_, _) => orbitMap.Invalidate();

        // Maneuver panel
        manScroll.Dock = DockStyle.Fill; manScroll.AutoScroll = true;
        manScroll.BackColor = Color.FromArgb(35, 35, 40);

        manPanel.Dock = DockStyle.Top; manPanel.AutoSize = true;
        manPanel.ColumnCount = 1; manPanel.Padding = new Padding(4);
        manPanel.BackColor = Color.FromArgb(35, 35, 40);

        splitMain.Panel1.Controls.Add(orbitMap);
        splitMain.Panel2.Controls.Add(manScroll);
        manScroll.Controls.Add(manPanel);
        splitMain.SplitterDistance = 920;

        BuildManPanel();

        // Bottom bar
        bottomBar.Dock = DockStyle.Fill; bottomBar.FlowDirection = FlowDirection.LeftToRight;
        bottomBar.Padding = new Padding(4, 1, 4, 1);
        bottomBar.BackColor = Color.FromArgb(40, 40, 40);

        lblStatusText.Text = ""; lblStatusText.AutoSize = true;
        lblStatusText.ForeColor = Color.FromArgb(200, 200, 200);
        lblStatusText.Font = new Font("Segoe UI", 7.5f);

        lblBot.Text = "Scroll=zoom  Mid=pan  D-clic=nó  R-clic=remove  Arraste ΔV";
        lblBot.AutoSize = true; lblBot.ForeColor = Color.FromArgb(160, 160, 160);
        lblBot.Font = new Font("Segoe UI", 7.5f);

        bottomBar.Controls.Add(lblStatusText);
        bottomBar.Controls.Add(lblBot);
        Controls.Add(mainLayout);
        ResumeLayout(false);
    }

    private void AddCtrl(Control c, int h)
    {
        if (h > 0) { manPanel.RowStyles.Add(new RowStyle(SizeType.Absolute, h)); c.Height = h; }
        else manPanel.RowStyles.Add(new RowStyle(SizeType.AutoSize));
        manPanel.RowCount++; c.Dock = DockStyle.Top;
        manPanel.Controls.Add(c, 0, manPanel.RowCount - 1);
    }

    private void Lbl(string t, bool bold, int h)
    {
        var l = new Label(); l.Text = t; l.Dock = DockStyle.Fill;
        l.TextAlign = ContentAlignment.MiddleLeft;
        l.Font = new Font("Segoe UI", 8.5f, bold ? FontStyle.Bold : FontStyle.Regular);
        l.ForeColor = Color.White; if (h > 0) l.Height = h; AddCtrl(l, h);
    }
    private void Sep() { var s = new Label(); s.Height = 1; s.BackColor = Color.FromArgb(60, 60, 65); AddCtrl(s, 3); }

    private void BuildManPanel()
    {
        manPanel.Controls.Clear(); manPanel.RowStyles.Clear(); manPanel.RowCount = 0;

        Lbl("MANEUVER", true, 22);
        Sep();

        // Increment selector
        var incRow = new FlowLayoutPanel();
        incRow.AutoSize = true; incRow.Margin = new Padding(0);
        var li = new Label(); li.Text = "Inc:"; li.AutoSize = true;
        li.ForeColor = Color.FromArgb(180, 180, 180); li.TextAlign = ContentAlignment.MiddleLeft;
        li.Font = new Font("Segoe UI", 8);
        cmbInc.DropDownStyle = ComboBoxStyle.DropDownList;
        cmbInc.Items.AddRange(new[] { "0.01", "0.1", "1", "5", "10", "100" });
        cmbInc.SelectedIndex = 2; cmbInc.Size = new Size(56, 20);
        cmbInc.BackColor = Color.FromArgb(50, 50, 55); cmbInc.ForeColor = Color.White;
        cmbInc.FlatStyle = FlatStyle.Flat; cmbInc.Font = new Font("Segoe UI", 7.5f);
        incRow.Controls.Add(li); incRow.Controls.Add(cmbInc);
        AddCtrl(incRow, 22);

        // Vector rows
        void VecRow(string name, Color c, NumericUpDown nud, Label val, Button bm, Button bp)
        {
            var r = new FlowLayoutPanel();
            r.AutoSize = true; r.Margin = new Padding(0);

            var ln = new Label(); ln.Text = name; ln.AutoSize = true;
            ln.ForeColor = c; ln.TextAlign = ContentAlignment.MiddleLeft;
            ln.Font = new Font("Segoe UI", 8, FontStyle.Bold); ln.Width = 38;

            bm.Text = "−"; bm.Size = new Size(24, 20); bm.BackColor = Color.FromArgb(65, 40, 40);
            bm.ForeColor = Color.White; bm.FlatStyle = FlatStyle.Flat; bm.Font = new Font("Segoe UI", 9);
            bm.Margin = new Padding(0, 0, 1, 0);
            bm.Click += (_, _) => { decimal inc = GetInc(); nud.Value = Math.Clamp(nud.Value - inc, nud.Minimum, nud.Maximum); };

            bp.Text = "+"; bp.Size = new Size(24, 20); bp.BackColor = Color.FromArgb(40, 65, 40);
            bp.ForeColor = Color.White; bp.FlatStyle = FlatStyle.Flat; bp.Font = new Font("Segoe UI", 9);
            bp.Margin = new Padding(1, 0, 0, 0);
            bp.Click += (_, _) => { decimal inc = GetInc(); nud.Value = Math.Clamp(nud.Value + inc, nud.Minimum, nud.Maximum); };

            nud.Minimum = -50000; nud.Maximum = 50000; nud.DecimalPlaces = 2;
            nud.Increment = 0.01m; nud.Width = 68; nud.Height = 20;
            nud.BackColor = Color.FromArgb(50, 50, 55); nud.ForeColor = Color.White;
            nud.TextAlign = HorizontalAlignment.Right; nud.Font = new Font("Segoe UI", 8);
            nud.Margin = new Padding(1, 0, 0, 0);
            nud.ValueChanged += ManeuverNud_ValueChanged;

            val.AutoSize = true; val.TextAlign = ContentAlignment.MiddleLeft;
            val.ForeColor = c; val.Font = new Font("Segoe UI", 8, FontStyle.Bold);
            val.Text = "0.00"; val.Width = 48; val.Padding = new Padding(4, 0, 0, 0);

            r.Controls.Add(ln); r.Controls.Add(bm); r.Controls.Add(nud); r.Controls.Add(bp); r.Controls.Add(val);
            AddCtrl(r, 22);
        }

        VecRow("Pro", Color.Magenta, nudPro, lblPro, btnProM, btnProP);
        VecRow("Nor", Color.MediumPurple, nudNor, lblNor, btnNorM, btnNorP);
        VecRow("Rad", Color.DodgerBlue, nudRad, lblRad, btnRadM, btnRadP);

        Sep();

        // Info
        var ip = new TableLayoutPanel();
        ip.Dock = DockStyle.Fill; ip.AutoSize = true; ip.ColumnCount = 2;
        ip.Padding = new Padding(2);
        ip.ColumnStyles.Add(new ColumnStyle(SizeType.AutoSize));
        ip.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));
        for (int i = 0; i < 8; i++) ip.RowStyles.Add(new RowStyle(SizeType.AutoSize));

        void InRow(string t, Label vl, int r)
        {
            var l = new Label(); l.Text = t; l.AutoSize = true;
            l.ForeColor = Color.FromArgb(170, 170, 170); l.TextAlign = ContentAlignment.MiddleLeft;
            l.Font = new Font("Segoe UI", 7.5f);
            vl.AutoSize = true; vl.ForeColor = Color.White; vl.TextAlign = ContentAlignment.MiddleRight;
            vl.Text = "--"; vl.Font = new Font("Segoe UI", 7.5f);
            ip.Controls.Add(l, 0, r); ip.Controls.Add(vl, 1, r);
        }
        InRow("ΔV:", lblDV, 0); InRow("Burn:", lblBurn, 1);
        InRow("", lblMnuName, 2); InRow("Pe':", lblPePost, 3);
        InRow("Ap':", lblApPost, 4); InRow("Enc:", lblEnc, 5);

        // Time row
        var tr = new FlowLayoutPanel(); tr.AutoSize = true; tr.Margin = new Padding(0);
        var lt = new Label(); lt.Text = "T+:"; lt.AutoSize = true;
        lt.ForeColor = Color.FromArgb(170, 170, 170); lt.TextAlign = ContentAlignment.MiddleLeft;
        lt.Font = new Font("Segoe UI", 7.5f);
        nudTime.Minimum = 0; nudTime.Maximum = 10000000; nudTime.DecimalPlaces = 1;
        nudTime.Increment = 1; nudTime.Width = 72; nudTime.Height = 20;
        nudTime.BackColor = Color.FromArgb(50, 50, 55); nudTime.ForeColor = Color.White;
        nudTime.TextAlign = HorizontalAlignment.Right; nudTime.Font = new Font("Segoe UI", 8);
        nudTime.ValueChanged += NodeTime_ValueChanged;
        var tm60 = Tb("-60", 30, Color.FromArgb(60, 60, 60), (_, _) => nudTime.Value = Math.Clamp(nudTime.Value - 60, nudTime.Minimum, nudTime.Maximum));
        var tm10 = Tb("-10", 26, Color.FromArgb(60, 60, 60), (_, _) => nudTime.Value = Math.Clamp(nudTime.Value - 10, nudTime.Minimum, nudTime.Maximum));
        var tp10 = Tb("+10", 26, Color.FromArgb(60, 80, 60), (_, _) => nudTime.Value = Math.Clamp(nudTime.Value + 10, nudTime.Minimum, nudTime.Maximum));
        var tp60 = Tb("+60", 30, Color.FromArgb(60, 80, 60), (_, _) => nudTime.Value = Math.Clamp(nudTime.Value + 60, nudTime.Minimum, nudTime.Maximum));
        tr.Controls.Add(lt); tr.Controls.Add(nudTime); tr.Controls.Add(tm60); tr.Controls.Add(tm10); tr.Controls.Add(tp10); tr.Controls.Add(tp60);
        ip.Controls.Add(tr, 0, 6); ip.SetColumnSpan(tr, 2);

        AddCtrl(ip, -1);
        Sep();

        // Action buttons
        var ap = new FlowLayoutPanel(); ap.AutoSize = true; ap.Margin = new Padding(0);
        void AB(string t, int w, Color c, EventHandler h)
        {
            var b = new Button(); b.Text = t; b.Size = new Size(w, 24);
            b.BackColor = c; b.ForeColor = Color.White; b.FlatStyle = FlatStyle.Flat;
            b.Font = new Font("Segoe UI", 7.5f); b.Margin = new Padding(0, 0, 2, 0);
            b.Click += h; ap.Controls.Add(b);
        }
        AB("Add", 50, Color.FromArgb(0, 100, 50), BtnAddNode_Click);
        AB("@Pe", 36, Color.FromArgb(0, 70, 90), BtnAddAtPe_Click);
        AB("@Ap", 36, Color.FromArgb(0, 70, 90), BtnAddAtAp_Click);
        AB("Circ", 40, Color.FromArgb(80, 60, 0), BtnCircularize_Click);
        AB("Del", 40, Color.FromArgb(100, 30, 30), BtnRemoveNode_Click);
        AddCtrl(ap, -1);
    }

    private Button Tb(string t, int w, Color c, EventHandler h)
    {
        var b = new Button(); b.Text = t; b.Size = new Size(w, 20);
        b.BackColor = c; b.ForeColor = Color.White; b.FlatStyle = FlatStyle.Flat;
        b.Font = new Font("Segoe UI", 7); b.Margin = new Padding(0, 0, 1, 0);
        b.Click += h; return b;
    }

    private decimal GetInc()
    {
        var s = cmbInc.SelectedItem?.ToString() ?? "1";
        return decimal.TryParse(s, out var v) ? v : 1m;
    }
}
