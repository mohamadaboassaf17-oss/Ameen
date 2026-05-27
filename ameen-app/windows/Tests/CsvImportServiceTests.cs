using System.Reflection;
using Ameen.Windows.Models;
using Ameen.Windows.Services;
using Xunit;

namespace Ameen.Windows.Tests;

public class CsvImportServiceTests
{
    private readonly CsvImportService _service = new();

    [Fact]
    public void ParseCsv_EmptyString_ReturnsZeroItems()
    {
        var result = _service.ParseCsv("");

        Assert.Equal(0, result.TotalRows);
        Assert.Equal(0, result.ImportedRows);
        Assert.Empty(result.Items);
    }

    [Fact]
    public void ParseCsv_HeaderOnly_ReturnsZeroItems()
    {
        var result = _service.ParseCsv("name,url,username,password");

        Assert.Equal(0, result.TotalRows);
        Assert.Equal(0, result.ImportedRows);
    }

    [Theory]
    [InlineData("name,url,username,password", CsvFormat.Chrome)]
    [InlineData("url,username,password,httpRealm,formActionOrigin,guid,timeCreated,timePasswordChanged", CsvFormat.Firefox)]
    [InlineData("name,url,username,password,note", CsvFormat.Edge)]
    [InlineData("title,url,username,password,otpauth", CsvFormat.Safari)]
    [InlineData("id,type,title,username,password,url,content,cardholder,number,expiry,cvv,notes,otpsecret", CsvFormat.Ameen)]
    public void ParseCsv_KnownHeaders_DetectsCorrectFormat(string header, CsvFormat expected)
    {
        var csv = header + "\nTest,https://test.com,user@test.com,pass123";
        var result = _service.ParseCsv(csv);

        Assert.Equal(expected, result.DetectedFormat);
    }

    [Fact]
    public void ParseCsv_UnknownHeader_DetectsUnknownFormat()
    {
        var csv = "column_a,column_b,column_c\nvalue1,value2,value3";

        var result = _service.ParseCsv(csv);

        Assert.Equal(CsvFormat.Unknown, result.DetectedFormat);
        Assert.Equal(0, result.ImportedRows);
    }

    [Fact]
    public void ParseCsv_UnknownHeader_NoItemsImported()
    {
        var csv = "foo,bar,baz\n1,2,3\n4,5,6";
        var result = _service.ParseCsv(csv);

        Assert.Equal(CsvFormat.Unknown, result.DetectedFormat);
        Assert.Empty(result.Items);
        Assert.Equal(0, result.ImportedRows);
    }

    [Theory]
    [InlineData("name,url,username,password\nGitHub,https://github.com,dev,secret123", "GitHub", "dev", "secret123", "https://github.com")]
    [InlineData("name,url,username,password\nGmail,https://mail.google.com,user@gmail.com,myp@ssw0rd", "Gmail", "user@gmail.com", "myp@ssw0rd", "https://mail.google.com")]
    public void ParseCsv_ChromeFormat_MapsCorrectly(string csv, string expectedTitle, string expectedUsername, string expectedPassword, string expectedUrl)
    {
        var result = _service.ParseCsv(csv);

        Assert.Equal(CsvFormat.Chrome, result.DetectedFormat);
        Assert.Equal(1, result.ImportedRows);
        var item = Assert.Single(result.Items);
        Assert.Equal(expectedTitle, item.Title);
        Assert.Equal(expectedUsername, item.Username);
        Assert.Equal(expectedPassword, item.Password);
        Assert.Equal(expectedUrl, item.Url);
        Assert.Equal("password", item.Type);
    }

    [Theory]
    [InlineData("title,url,username,password,otpauth\nAmazon,https://amazon.com,shop@mail.com,pass123,otpauth://totp/test")]
    [InlineData("  title , url , username , password , otpauth \n  Amazon  ,  https://amazon.com  ,  shop@mail.com  ,  pass123  ,  otpauth://totp/test  ")]
    public void ParseCsv_SafariFormat_WithWhitespace_MapsCorrectly(string csv)
    {
        var result = _service.ParseCsv(csv);

        Assert.Equal(CsvFormat.Safari, result.DetectedFormat);
        Assert.Equal(1, result.ImportedRows);
        var item = Assert.Single(result.Items);
        Assert.Equal("Amazon", item.Title);
        Assert.Equal("shop@mail.com", item.Username);
        Assert.Equal("pass123", item.Password);
        Assert.Equal("https://amazon.com", item.Url);
        Assert.Equal("otpauth://totp/test", item.OtpSecret);
    }

    [Fact]
    public void ParseCsv_EdgeFormat_MapsCorrectly()
    {
        var csv = "name,url,username,password,note\nBank,https://bank.com,user,secure456,My bank login";

        var result = _service.ParseCsv(csv);

        Assert.Equal(CsvFormat.Edge, result.DetectedFormat);
        var item = Assert.Single(result.Items);
        Assert.Equal("Bank", item.Title);
        Assert.Equal("https://bank.com", item.Url);
        Assert.Equal("My bank login", item.Notes);
    }

    [Fact]
    public void ParseCsv_FirefoxFormat_UsesUrlAsTitle()
    {
        var csv = "url,username,password,httpRealm,formActionOrigin,guid,timeCreated,timePasswordChanged\nhttps://example.com,user1,pass1,,,guid123,1234567890,1234567890";

        var result = _service.ParseCsv(csv);

        Assert.Equal(CsvFormat.Firefox, result.DetectedFormat);
        var item = Assert.Single(result.Items);
        Assert.Equal("https://example.com", item.Title);
    }

    [Fact]
    public void ParseCsv_LargeDataset_CountsCorrectly()
    {
        var lines = new List<string> { "name,url,username,password" };
        for (int i = 0; i < 100; i++)
            lines.Add($"Site{i},https://site{i}.com,user{i}@mail.com,pass{i:D4}");

        var csv = string.Join("\n", lines);
        var result = _service.ParseCsv(csv);

        Assert.Equal(100, result.TotalRows);
        Assert.Equal(100, result.ImportedRows);
        Assert.Equal(0, result.SkippedRows);
        Assert.Equal(100, result.Items.Count);
    }

    [Fact]
    public void ParseCsv_EmptyLines_AreSkipped()
    {
        var csv = "name,url,username,password\n\nSiteA,https://a.com,u1,p1\n\n\nSiteB,https://b.com,u2,p2\n";

        var result = _service.ParseCsv(csv);

        Assert.Equal(2, result.ImportedRows);
    }

    [Theory]
    [InlineData("name,url,username,password\n,https://site.com,,\nGoogle,https://google.com,,,user@google.com")]
    [InlineData("url,username,password,httpRealm,formActionOrigin,guid,timeCreated,timePasswordChanged\nhttps://site.com,,,\nhttps://google.com,user,pass,,,g1,111,222,,,,")]
    public void ParseCsv_EmptyTitleAndUsername_ReturnsNullItem(string csv)
    {
        var result = _service.ParseCsv(csv);

        Assert.True(result.TotalRows >= 2);
        // At least one row should be skipped due to MapToVaultItem returning null
        Assert.True(result.SkippedRows > 0);
    }

    [Theory]
    [InlineData("id,type,title,username,password,url,content,cardholder,number,expiry,cvv,notes,otpsecret")]
    [InlineData("id,type,title,username,password,url,content,cardholder,number,expiry,cvv,notes,otpsecret\n1,password,MySite,user,pass,https://site.com,,,,,,,notes here,otp_secret")]
    public void ParseCsv_AmeenFormat_Detected(string csv)
    {
        var result = _service.ParseCsv(csv);

        Assert.Equal(CsvFormat.Ameen, result.DetectedFormat);
    }
}
